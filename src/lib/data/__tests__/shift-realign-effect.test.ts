// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT — cung khuon `payroll-run.test.ts`:
// doanh nghiep RIENG cho moi lan chay (khong dung chung `cty-01`, de khong dam
// vao cac test tich hop khac chay song song).
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getSessionContext } from "@/lib/auth/session-context";
import {
  applyShiftRealign,
  previewShiftRealign,
} from "@/lib/data/mutations/shift-realign";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * AP CA LINH HOAT CHO KY CHUA CHOT.
 *
 * BAI KIEM CHINH la bai 3: ngay thuoc ky DA CHOT khong doi. Neu bai do do thi
 * moi bai con lai co xanh cung khong co nghia — mot bang luong da chot se bi
 * doi so lieu goc ben duoi no.
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return { ...actual, getSessionContext: vi.fn() };
});

describe("applyShiftRealign — chỉ kỳ chưa chốt, chỉ chiều sang ca linh hoạt", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SECRET_KEY — test này chạy trên Postgres dev thật, cần .env.local.",
    );
  }
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const suffix = randomUUID().slice(0, 8);
  const COMPANY_ID = `cty-rea-${suffix}`;
  const DEPARTMENT_ID = `dept-rea-${suffix}`;
  const FIXED_SHIFT_ID = `sft-rea-fix-${suffix}`;
  const FLEX_SHIFT_ID = `sft-rea-flex-${suffix}`;
  const EMPLOYEE_ID = `emp-rea-${suffix}`;

  /** Thang DA CHOT va thang CHUA CHOT — hai ve doi nhau cua bai kiem chinh. */
  const CLOSED_MONTH_START = "2015-03-01";
  const CLOSED_DAY = "2015-03-02";
  const OPEN_DAY_A = "2015-04-01";
  const OPEN_DAY_B = "2015-04-02";

  let actorUserId = "";

  function session(role: "owner" | "employee" = "owner") {
    return {
      userId: actorUserId,
      email: `test-rea-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_ID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  async function insertRecord(
    id: string,
    workDate: string,
    shiftId: string,
    status: "late" | "on_time",
    lateMinutes: number,
  ): Promise<void> {
    const { data: checkInAt } = await admin.rpc("tf_local_instant", {
      p_date: workDate,
      p_time: "09:00:00",
    });
    const { data: checkOutAt } = await admin.rpc("tf_local_instant", {
      p_date: workDate,
      p_time: "17:00:00",
    });
    const { error } = await admin.from("attendance_records").insert({
      id,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      work_date: workDate,
      shift_id: shiftId,
      check_in_at: checkInAt as string,
      check_out_at: checkOutAt as string,
      worked_minutes: 480,
      late_minutes: lateMinutes,
      early_leave_minutes: 0,
      status,
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    });
    if (error) throw new Error(`Không chèn được bản ghi ${id}: ${error.message}`);
  }

  async function readRecord(id: string) {
    const { data } = await admin
      .from("attendance_records")
      .select("shift_id, status, late_minutes, early_leave_minutes, worked_minutes")
      .eq("id", id)
      .single();
    return data as {
      shift_id: string;
      status: string;
      late_minutes: number;
      early_leave_minutes: number;
      worked_minutes: number;
    };
  }

  beforeAll(async () => {
    const { data: createdUser, error: userError } =
      await admin.auth.admin.createUser({
        email: `test-rea-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (userError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${userError?.message}`);
    }
    actorUserId = createdUser.user.id;

    await admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiệp test áp ca ${suffix}`,
      code: `REA${suffix.slice(0, 5).toUpperCase()}`,
      industry: "services",
      size: "1-10",
      phone: "0900000000",
      address: "Test",
      accent: "indigo",
    });
    await admin.from("departments").insert({
      id: DEPARTMENT_ID,
      company_id: COMPANY_ID,
      name: "Phòng test áp ca",
      description: "Test",
      manager_id: null,
      status: "active",
    });
    await admin.from("shifts").insert([
      {
        id: FIXED_SHIFT_ID,
        company_id: COMPANY_ID,
        name: "Ca sáng test",
        code: `REAF${suffix.slice(0, 4).toUpperCase()}`,
        kind: "fixed",
        start_time: "06:00",
        end_time: "14:00",
        duration_minutes: null,
        break_minutes: 0,
        late_tolerance_minutes: 0,
        working_days: [1, 2, 3, 4, 5, 6, 7],
        status: "active",
      },
      {
        id: FLEX_SHIFT_ID,
        company_id: COMPANY_ID,
        name: "Ca linh hoạt test",
        code: `REAX${suffix.slice(0, 4).toUpperCase()}`,
        kind: "hours",
        start_time: null,
        end_time: null,
        duration_minutes: 120,
        break_minutes: 0,
        late_tolerance_minutes: 0,
        working_days: [1, 2, 3, 4, 5, 6, 7],
        status: "active",
      },
    ]);
    await admin.from("employees").insert({
      id: EMPLOYEE_ID,
      company_id: COMPANY_ID,
      code: "REA001",
      full_name: "Người test áp ca",
      email: `${EMPLOYEE_ID}@timeflow.test`,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male",
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Nhân viên",
      contract_type: "full_time",
      start_date: "2014-01-01",
      manager_id: null,
      // BAT DAU o ca CO GIO — dung tinh huong that.
      shift_id: FIXED_SHIFT_ID,
      work_location: "Văn phòng chính",
      status: "active",
      system_role: "employee",
      invitation_sent: false,
      can_view_payslip: false,
      can_check_in_remotely: false,
      user_id: null,
    });

    // Ba ngay di muon o ca co gio: mot ngay thuoc thang SE CHOT, hai ngay
    // thuoc thang de mo.
    await insertRecord(`att-rea-c-${suffix}`, CLOSED_DAY, FIXED_SHIFT_ID, "late", 180);
    await insertRecord(`att-rea-a-${suffix}`, OPEN_DAY_A, FIXED_SHIFT_ID, "late", 180);
    await insertRecord(`att-rea-b-${suffix}`, OPEN_DAY_B, FIXED_SHIFT_ID, "on_time", 0);

    // CHOT ky thang 03/2015 — tu day trigger `attendance_period_guard` chan
    // moi thao tac ghi vao ngay do.
    await admin.from("periods").insert({
      company_id: COMPANY_ID,
      start_date: CLOSED_MONTH_START,
      end_date: "2015-03-31",
      status: "closed",
    });

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  afterAll(async () => {
    await admin.from("periods").delete().eq("company_id", COMPANY_ID);
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.from("audit_log").delete().eq("actor_user_id", actorUserId);
    await admin.from("employees").delete().eq("company_id", COMPANY_ID);
    await admin.from("shifts").delete().eq("company_id", COMPANY_ID);
    await admin.from("departments").delete().eq("company_id", COMPANY_ID);
    await admin.from("companies").delete().eq("id", COMPANY_ID);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. ca hiện tại CÓ GIỜ -> từ chối, không ghi gì", async () => {
    await expect(previewShiftRealign(EMPLOYEE_ID)).rejects.toThrow(
      /Chỉ áp được cho ca linh hoạt/,
    );
    await expect(applyShiftRealign(EMPLOYEE_ID)).rejects.toThrow(
      /Chỉ áp được cho ca linh hoạt/,
    );

    // Va khong ban ghi nao bi dung toi.
    const record = await readRecord(`att-rea-a-${suffix}`);
    expect(record.status).toBe("late");
    expect(record.late_minutes).toBe(180);
  });

  it("2. sau khi đổi sang ca linh hoạt -> preview đếm ĐÚNG, loại kỳ đã chốt", async () => {
    await admin
      .from("employees")
      .update({ shift_id: FLEX_SHIFT_ID })
      .eq("id", EMPLOYEE_ID);

    const preview = await previewShiftRealign(EMPLOYEE_ID);

    // Ba ban ghi, nhung ngay 02/03 thuoc ky DA CHOT -> chi con hai.
    expect(preview.dayCount).toBe(2);
    expect(preview.lateDayCount).toBe(1);
    expect(preview.months).toEqual(["2015-04"]);
    expect(preview.shiftName).toBe("Ca linh hoạt test");
  });

  it("3. BÀI KIỂM CHÍNH: apply đổi kỳ mở, KHÔNG đụng kỳ đã chốt", async () => {
    const result = await applyShiftRealign(EMPLOYEE_ID);
    expect(result.dayCount).toBe(2);

    const open = await readRecord(`att-rea-a-${suffix}`);
    expect(open.shift_id).toBe(FLEX_SHIFT_ID);
    expect(open.status).toBe("on_time");
    expect(open.late_minutes).toBe(0);
    // So gio KHONG bi tinh lai — no la thoi luong tho cua lan cham cong that.
    expect(open.worked_minutes).toBe(480);

    const closed = await readRecord(`att-rea-c-${suffix}`);
    expect(closed.shift_id).toBe(FIXED_SHIFT_ID);
    expect(closed.status).toBe("late");
    expect(closed.late_minutes).toBe(180);
  });

  it("4. chạy lại lần hai -> không còn gì để đổi", async () => {
    const preview = await previewShiftRealign(EMPLOYEE_ID);
    expect(preview.dayCount).toBe(0);

    const result = await applyShiftRealign(EMPLOYEE_ID);
    expect(result.dayCount).toBe(0);
  });

  it("5. để lại ĐÚNG MỘT dòng audit tổng hợp, không phải một dòng mỗi ngày", async () => {
    const { data } = await admin
      .from("audit_log")
      .select("action, entity_table, entity_id, reason, after")
      .eq("actor_user_id", actorUserId)
      .eq("entity_table", "attendance_records");

    const rows = (data ?? []) as Array<{
      entity_id: string;
      reason: string;
      after: { day_count: number; work_dates: string[] };
    }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].entity_id).toBe(EMPLOYEE_ID);
    expect(rows[0].reason).toBe("Áp ca linh hoạt cho kỳ chưa chốt");
    expect(rows[0].after.day_count).toBe(2);
    expect(rows[0].after.work_dates).toEqual([OPEN_DAY_A, OPEN_DAY_B]);
  });

  it("6. vai trò employee bị từ chối ở CẢ hai hàm", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session("employee"));

    await expect(previewShiftRealign(EMPLOYEE_ID)).rejects.toThrow();
    await expect(applyShiftRealign(EMPLOYEE_ID)).rejects.toThrow();

    vi.mocked(getSessionContext).mockResolvedValue(session());
  });
});
