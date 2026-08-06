// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as GET_USAGE } from "@/app/api/requests/overtime-usage/route";
import { getSessionContext } from "@/lib/auth/session-context";
import { updateCompanySettings } from "@/lib/data/mutations/settings";
import { createServerSupabase } from "@/lib/supabase/server";
import type { OvertimeUsage } from "@/lib/types/domain";

/**
 * SET-05 tren du lieu that: ba con so cua canh bao den tu dau.
 *
 * Bai kiem quan trong nhat la bai cuoi: doi tran o cau hinh doanh nghiep roi
 * doc lai — `capHours` doi theo, va KHONG cot nao luu san "gio da dung" de
 * lech (prohibition cua plan). Cung khuon `settings-effect.test.ts` cua 04-01.
 *
 * Fixture dung mot doanh nghiep RIENG mang dinh danh ngau nhien: `overtime_rules`
 * la append-only nen doanh nghiep test khong xoa duoc o cuoi.
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

/** Thang co dinh trong qua khu — khong dung chung voi fixture khac. */
const MONTH = "2017-11";
/** 2017-11-01 la Thu Tu; ca test lam Thu Hai–Thu Sau, 08:00–16:00 (480 phut). */
const WORK_DATE_A = "2017-11-01";
const WORK_DATE_B = "2017-11-02";

describe("Giờ tăng ca đã dùng trong tháng và trần doanh nghiệp (SET-05)", () => {
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

  const suffix = randomUUID().slice(0, 8);
  const COMPANY_ID = `cty-0503-${suffix}`;
  const DEPARTMENT_ID = `dept-0503-${suffix}`;
  const SHIFT_ID = `sft-0503-${suffix}`;
  const EMPLOYEE_ID = `emp-0503-${suffix}`;
  const OTHER_EMPLOYEE_ID = `emp-0503-${suffix}-b`;
  const REQUEST_REGISTERED = `wr-0503-${suffix}-registered`;
  const REQUEST_UNDER_REVIEW = `wr-0503-${suffix}-review`;

  let actorUserId = "";

  function session(role: "owner" | "employee" = "owner") {
    return {
      userId: actorUserId,
      email: `test-05-03-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_ID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  async function readUsage(params?: {
    employeeId?: string;
    excludeRequestId?: string;
  }): Promise<OvertimeUsage> {
    const search = new URLSearchParams({
      employeeId: params?.employeeId ?? EMPLOYEE_ID,
      month: MONTH,
    });
    if (params?.excludeRequestId) {
      search.set("excludeRequestId", params.excludeRequestId);
    }
    const response = await GET_USAGE(
      new Request(`http://localhost/api/requests/overtime-usage?${search}`),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as OvertimeUsage;
  }

  /** Mot ngay cong that: vao 08:00, ra `checkOut` (gio VN). */
  async function insertDay(date: string, checkOut: string): Promise<void> {
    const { data: checkInAt } = await admin.rpc("tf_local_instant", {
      p_date: date,
      p_time: "08:00:00",
    });
    const { data: checkOutAt } = await admin.rpc("tf_local_instant", {
      p_date: date,
      p_time: checkOut,
    });
    const { data: worked } = await admin.rpc("tf_worked_minutes", {
      p_check_in: checkInAt as string,
      p_check_out: checkOutAt as string,
      p_break_minutes: 0,
    });

    const { error } = await admin.from("attendance_records").insert({
      id: `att-0503-${suffix}-${date}`,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      work_date: date,
      shift_id: SHIFT_ID,
      check_in_at: checkInAt as string,
      check_out_at: checkOutAt as string,
      worked_minutes: worked as number,
      late_minutes: 0,
      early_leave_minutes: 0,
      status: "on_time",
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    });
    if (error) throw new Error(`Không tạo được bản ghi ${date}: ${error.message}`);
  }

  beforeAll(async () => {
    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: `test-05-03-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (createUserError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${createUserError?.message}`);
    }
    actorUserId = createdUser.user.id;

    const { error: companyError } = await admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiệp test 05-03 ${suffix}`,
      code: `T0503${suffix.slice(0, 4).toUpperCase()}`,
      industry: "services",
      size: "1-10",
      phone: "0900000000",
      address: "Test",
      accent: "indigo",
    });
    if (companyError) {
      throw new Error(`Không tạo được doanh nghiệp test: ${companyError.message}`);
    }
    // Doanh nghiep moi: KHONG tran (D-26) — bai kiem dau tien dua vao dieu do.
    await admin.from("company_settings").insert({ company_id: COMPANY_ID });

    await admin.from("departments").insert({
      id: DEPARTMENT_ID,
      company_id: COMPANY_ID,
      name: "Phòng test",
      description: "Test 05-03",
      manager_id: null,
      status: "active",
    });

    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test 05-03",
      code: "T0503",
      start_time: "08:00",
      end_time: "16:00",
      break_minutes: 0,
      late_tolerance_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
      status: "active",
    });

    const baseEmployee = {
      company_id: COMPANY_ID,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male" as const,
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Test",
      contract_type: "full_time" as const,
      start_date: "2016-01-01",
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

    await admin.from("employees").insert([
      {
        ...baseEmployee,
        id: EMPLOYEE_ID,
        code: "T0503A",
        full_name: "Nhân viên test 05-03",
        email: `${EMPLOYEE_ID}@timeflow.test`,
      },
      {
        ...baseEmployee,
        id: OTHER_EMPLOYEE_ID,
        code: "T0503B",
        full_name: "Nhân viên test 05-03 (B)",
        email: `${OTHER_EMPLOYEE_ID}@timeflow.test`,
      },
    ]);

    // Hai ngay lam den 18:00 -> moi ngay 600 phut, vuot ke hoach 480 -> 120
    // phut tang ca/ngay = 4 gio tang ca THUC TE trong thang.
    await insertDay(WORK_DATE_A, "18:00:00");
    await insertDay(WORK_DATE_B, "18:00:00");

    await admin.from("work_requests").insert([
      {
        id: REQUEST_REGISTERED,
        company_id: COMPANY_ID,
        employee_id: EMPLOYEE_ID,
        type: "overtime",
        status: "approved",
        from_date: "2017-11-08",
        to_date: "2017-11-08",
        from_time: "18:00",
        to_time: "21:00",
        reason: "[test 05-03] Đã đăng ký và được duyệt (3 giờ).",
      },
      {
        id: REQUEST_UNDER_REVIEW,
        company_id: COMPANY_ID,
        employee_id: EMPLOYEE_ID,
        type: "overtime",
        status: "approved",
        from_date: "2017-11-09",
        to_date: "2017-11-09",
        from_time: "18:00",
        to_time: "20:00",
        reason: "[test 05-03] Yêu cầu đang xét (2 giờ).",
      },
    ]);

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  afterAll(async () => {
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.from("work_requests").delete().eq("company_id", COMPANY_ID);
    await admin.from("audit_log").delete().eq("actor_user_id", actorUserId);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. doanh nghiệp chưa khai trần -> capHours là null, không phải 0 (D-26)", async () => {
    const usage = await readUsage();

    expect(usage.capHours).toBeNull();
    // Gio THUC TE den tu du lieu cham cong: 2 ngay x 120 phut = 4 gio.
    expect(usage.actualHours).toBe(4);
    // Gio DA DANG KY: hai yeu cau tang ca da duyet (3h + 2h).
    expect(usage.registeredHours).toBe(5);
    expect(usage.usedHours).toBe(9);
  });

  it("2. excludeRequestId loại đúng yêu cầu đang xét khỏi phần 'đã dùng'", async () => {
    const usage = await readUsage({ excludeRequestId: REQUEST_UNDER_REVIEW });

    // 5 - 2 = 3 gio con lai; gio thuc te khong doi.
    expect(usage.registeredHours).toBe(3);
    expect(usage.actualHours).toBe(4);
    expect(usage.usedHours).toBe(7);
  });

  it("3. đổi trần ở cấu hình doanh nghiệp -> đường đọc trả trần mới, giờ đã dùng KHÔNG đổi", async () => {
    const before = await readUsage();

    await updateCompanySettings({ overtimeCapHoursPerMonth: 20 });
    const withCap = await readUsage();
    expect(withCap.capHours).toBe(20);
    expect(withCap.usedHours).toBe(before.usedHours);

    await updateCompanySettings({ overtimeCapHoursPerMonth: 8 });
    const tighter = await readUsage();
    expect(tighter.capHours).toBe(8);
    expect(tighter.usedHours).toBe(before.usedHours);

    // Xoa tran -> ve lai "khong gioi han", KHONG phai 0.
    await updateCompanySettings({ overtimeCapHoursPerMonth: null });
    const cleared = await readUsage();
    expect(cleared.capHours).toBeNull();
    expect(cleared.usedHours).toBe(before.usedHours);
  });

  it("4. nhân viên chưa có dữ liệu nào trong tháng -> trả 0, không phải lỗi", async () => {
    const usage = await readUsage({ employeeId: OTHER_EMPLOYEE_ID });

    expect(usage.actualHours).toBe(0);
    expect(usage.registeredHours).toBe(0);
    expect(usage.usedHours).toBe(0);
  });

  it("5. vai trò employee hỏi giờ của người khác -> 403 (AUTH-03)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session("employee"));

    const response = await GET_USAGE(
      new Request(
        `http://localhost/api/requests/overtime-usage?employeeId=${OTHER_EMPLOYEE_ID}&month=${MONTH}`,
      ),
    );
    expect(response.status).toBe(403);

    // Hoi CHINH MINH thi van doc duoc.
    const own = await GET_USAGE(
      new Request(
        `http://localhost/api/requests/overtime-usage?employeeId=${EMPLOYEE_ID}&month=${MONTH}`,
      ),
    );
    expect(own.status).toBe(200);

    vi.mocked(getSessionContext).mockResolvedValue(session());
  });
});
