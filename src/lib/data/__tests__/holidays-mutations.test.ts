// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT (khuon `attendance-evidence.test.ts` cua
// 03-04): `createServerSupabase` mock ve client dung `SUPABASE_SECRET_KEY`,
// `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import {
  countAffectedAttendance,
  createHoliday,
  deleteHoliday,
  updateHoliday,
} from "@/lib/data/mutations/holidays";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Sau hanh vi cua `<behavior>` Task 2 (04-03-PLAN.md) tren du lieu that. Hai
 * bai quan trong nhat:
 *   - `id` cua doanh nghiep KHAC khong sua/xoa duoc va KHONG im lang thanh
 *     cong (ranh gioi doanh nghiep o duong ghi);
 *   - `countAffectedAttendance()` dem DUNG so ban ghi cham cong cua ngay do —
 *     day la con so ma man hinh dua vao de canh bao nguoi bam rang ho dang
 *     sua qua khu (D-25b), sai con so nay la sai chinh lop bao ve duy nhat.
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return {
    ...actual,
    getSessionContext: vi.fn(),
  };
});

const COMPANY_ID = "cty-01";
const OTHER_COMPANY_ID = "cty-02";
const DEPARTMENT_ID = "dept-01";
const SHIFT_ID = "sft-01-day";

const EMPLOYEE_ID = "emp-04-03-hol";
const EMPLOYEE_ID_2 = "emp-04-03-hol2";
const TEST_EMPLOYEE_IDS = [EMPLOYEE_ID, EMPLOYEE_ID_2];
/** Ngay co dinh trong qua khu, khong dung chung voi bat ky fixture nao khac. */
const PAST_DATE = "2019-03-14";
const FREE_DATE = "2019-03-15";

describe("Ngày nghỉ lễ — ba đường ghi và phép đếm ảnh hưởng (SET-02)", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SECRET_KEY — test này chạy trên Postgres dev thật đã seed, cần .env.local.",
    );
  }
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let actorUserId = "";
  let actorEmail = "";
  let otherCompanyHolidayId = "";
  const createdHolidayIds: string[] = [];

  function session(role: "owner" | "manager") {
    return {
      userId: actorUserId,
      email: actorEmail,
      companyId: COMPANY_ID,
      role,
      employeeId: null,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  beforeAll(async () => {
    actorEmail = `test-04-03-${randomUUID()}@timeflow.test`;
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: actorEmail,
        password: randomUUID(),
        email_confirm: true,
      });
    if (createUserError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${createUserError?.message}`);
    }
    actorUserId = createdUser.user.id;

    const baseEmployee = {
      company_id: COMPANY_ID,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male" as const,
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Test",
      contract_type: "full_time" as const,
      start_date: "2018-01-01",
      manager_id: null,
      shift_id: SHIFT_ID,
      work_location: "Văn phòng chính",
      status: "active" as const,
      system_role: "employee" as const,
      invitation_sent: false,
      can_view_payslip: false,
      can_check_in_remotely: false,
      user_id: null,
    };

    const { error: employeeError } = await admin.from("employees").insert([
      {
        ...baseEmployee,
        id: EMPLOYEE_ID,
        code: "T0403HOL",
        full_name: "Nhân viên test 04-03",
        email: `${EMPLOYEE_ID}@timeflow.test`,
      },
      {
        ...baseEmployee,
        id: EMPLOYEE_ID_2,
        code: "T0403HOL2",
        full_name: "Nhân viên test 04-03 (2)",
        email: `${EMPLOYEE_ID_2}@timeflow.test`,
      },
    ]);
    if (employeeError) {
      throw new Error(`Không tạo được employees test: ${employeeError.message}`);
    }

    // HAI ban ghi cham cong trong PAST_DATE (hai nhan vien khac nhau — rang
    // buoc unique la (employee_id, work_date, shift_id)) de phep dem phai tra
    // dung 2, khong phai 1 (mot con so 1 co the dung do trung hop).
    const { error: recordsError } = await admin.from("attendance_records").insert([
      {
        id: "att-04-03-h1",
        company_id: COMPANY_ID,
        employee_id: EMPLOYEE_ID,
        work_date: PAST_DATE,
        shift_id: SHIFT_ID,
        check_in_at: null,
        check_out_at: null,
        worked_minutes: 0,
        late_minutes: 0,
        early_leave_minutes: 0,
        status: "on_time",
        location: "Văn phòng chính",
        needs_supplement: false,
        note: null,
      },
      {
        id: "att-04-03-h2",
        company_id: COMPANY_ID,
        employee_id: EMPLOYEE_ID_2,
        work_date: PAST_DATE,
        shift_id: SHIFT_ID,
        check_in_at: null,
        check_out_at: null,
        worked_minutes: 0,
        late_minutes: 0,
        early_leave_minutes: 0,
        status: "on_time",
        location: "Văn phòng chính",
        needs_supplement: false,
        note: null,
      },
    ]);
    if (recordsError) {
      throw new Error(`Không tạo được attendance_records test: ${recordsError.message}`);
    }

    // Mot ngay le cua DOANH NGHIEP KHAC, de kiem ranh gioi o duong ghi.
    const { data: otherRow, error: otherError } = await admin
      .from("holidays")
      .insert({
        company_id: OTHER_COMPANY_ID,
        holiday_date: PAST_DATE,
        name: "Ngày lễ của doanh nghiệp khác (test 04-03)",
      })
      .select("id")
      .single();
    if (otherError || !otherRow) {
      throw new Error(`Không tạo được ngày lễ cty-02: ${otherError?.message}`);
    }
    otherCompanyHolidayId = otherRow.id as string;

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session("owner"));
  });

  afterAll(async () => {
    if (createdHolidayIds.length > 0) {
      await admin.from("holidays").delete().in("id", createdHolidayIds);
    }
    await admin.from("holidays").delete().eq("id", otherCompanyHolidayId);
    await admin.from("audit_log").delete().eq("actor_user_id", actorUserId);
    await admin.from("employees").delete().in("id", TEST_EMPLOYEE_IDS);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. createHoliday ghi đúng doanh nghiệp của phiên và để lại một dòng audit", async () => {
    const holiday = await createHoliday({ date: FREE_DATE, name: "Ngày test 04-03" });
    createdHolidayIds.push(holiday.id);

    expect(holiday.companyId).toBe(COMPANY_ID);
    expect(holiday.date).toBe(FREE_DATE);

    const { data: audit } = await admin
      .from("audit_log")
      .select("action, entity_table, entity_id, reason")
      .eq("actor_user_id", actorUserId)
      .eq("entity_id", holiday.id);

    expect(audit).toHaveLength(1);
    expect(audit?.[0].action).toBe("insert");
    expect(audit?.[0].entity_table).toBe("holidays");
    // Ngay nay chua co ban ghi cham cong nao -> reason null (khong bia mot
    // canh bao khi khong co gi bi anh huong).
    expect(audit?.[0].reason).toBeNull();
  });

  it("2. trùng ngày trong cùng doanh nghiệp -> thông điệp tiếng Việt, không phải lỗi Postgres thô", async () => {
    await expect(
      createHoliday({ date: FREE_DATE, name: "Trùng ngày" }),
    ).rejects.toThrow(/đã được khai là ngày nghỉ lễ/);
  });

  it("3. countAffectedAttendance đếm đúng số bản ghi của ngày đó, 0 cho ngày chưa có bản ghi", async () => {
    expect(await countAffectedAttendance(PAST_DATE)).toBe(2);
    expect(await countAffectedAttendance(FREE_DATE)).toBe(0);
  });

  it("4. thao tác trên ngày quá khứ CÓ bản ghi -> audit mang reason kèm số bản ghi bị ảnh hưởng (D-25b)", async () => {
    const holiday = await createHoliday({ date: PAST_DATE, name: "Ngày quá khứ test" });
    createdHolidayIds.push(holiday.id);

    const { data: audit } = await admin
      .from("audit_log")
      .select("reason")
      .eq("actor_user_id", actorUserId)
      .eq("entity_id", holiday.id)
      .single();

    expect(audit?.reason).toContain("2 bản ghi chấm công");
  });

  it("5. id của doanh nghiệp KHÁC -> updateHoliday/deleteHoliday báo không tìm thấy, dòng vẫn còn nguyên", async () => {
    await expect(
      updateHoliday(otherCompanyHolidayId, { name: "Bị sửa trộm" }),
    ).rejects.toThrow("Không tìm thấy ngày nghỉ lễ.");
    await expect(deleteHoliday(otherCompanyHolidayId)).rejects.toThrow(
      "Không tìm thấy ngày nghỉ lễ.",
    );

    const { data: still } = await admin
      .from("holidays")
      .select("id, name")
      .eq("id", otherCompanyHolidayId)
      .single();

    expect(still?.id).toBe(otherCompanyHolidayId);
    expect(still?.name).toBe("Ngày lễ của doanh nghiệp khác (test 04-03)");
  });

  it("6. vai trò manager bị từ chối ở cả ba đường ghi và ở phép đếm", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session("manager"));

    await expect(
      createHoliday({ date: "2019-03-16", name: "Không được phép" }),
    ).rejects.toThrow(ForbiddenError);
    await expect(updateHoliday(createdHolidayIds[0], { name: "X" })).rejects.toThrow(
      ForbiddenError,
    );
    await expect(deleteHoliday(createdHolidayIds[0])).rejects.toThrow(ForbiddenError);
    await expect(countAffectedAttendance(PAST_DATE)).rejects.toThrow(ForbiddenError);

    vi.mocked(getSessionContext).mockResolvedValue(session("owner"));
  });

  it("7. deleteHoliday xoá đúng dòng của mình và ghi audit action=delete", async () => {
    const target = createdHolidayIds.pop() as string;
    await deleteHoliday(target);

    const { data: gone } = await admin
      .from("holidays")
      .select("id")
      .eq("id", target)
      .maybeSingle();
    expect(gone).toBeNull();

    const { data: audit } = await admin
      .from("audit_log")
      .select("action")
      .eq("actor_user_id", actorUserId)
      .eq("entity_id", target)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(audit?.action).toBe("delete");
  });
});
