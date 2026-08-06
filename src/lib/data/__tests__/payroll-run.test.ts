// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as GET_PAYROLL } from "@/app/api/payroll/summary/route";
import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { closePayroll, reopenPayroll } from "@/lib/data/mutations/payroll";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PayrollPrep } from "@/lib/types/domain";

/**
 * CHOT LUONG mot ky (D-42/D-45).
 *
 * BAI KIEM CHINH la bai 5: **doi muc luong SAU KHI chot roi doc lai -> con so
 * cua ky da chot KHONG DOI**. Do la toan bo ly do ban chot ton tai. Neu bai do
 * do, moi bai con lai co xanh cung khong co nghia gi: bang luong thang 07 se
 * doi theo cau hinh cua thang 09, va cau hoi "thang 07 da tra bao nhieu" mat
 * cau tra loi.
 *
 * Bo so: ca 08:00-16:00, 20 ngay cong chuan, 8 gio/ngay, he so tang ca 1,5,
 * luong 20.000.000/thang -> don gia ngay 1.000.000, don gia gio 125.000.
 * Mot ngay lam du 8 tieng -> 1 ngay cong -> THUC NHAN 1.000.000.
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

const MONTH = "2015-06";
const PERIOD_START = "2015-06-01";
const WORK_DAY = "2015-06-01"; // Thu Hai

const MONTHLY_SALARY = 20_000_000;
const EXPECTED_NET = 1_000_000;

describe("Chốt lương kỳ và bản chốt tự chứa (D-42/D-45)", () => {
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
  const COMPANY_ID = `cty-run-${suffix}`;
  const DEPARTMENT_ID = `dept-run-${suffix}`;
  const SHIFT_ID = `sft-run-${suffix}`;
  const EMPLOYEE_ID = `emp-run-${suffix}`;
  /** Chua khai luong — chi duoc them vao o bai 2 roi go ra. */
  const EMPLOYEE_UNPAID = `emp-run-${suffix}-x`;

  let actorUserId = "";

  function session(role: "owner" | "employee" = "owner") {
    return {
      userId: actorUserId,
      email: `test-run-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_ID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  async function readPayroll(): Promise<PayrollPrep> {
    const response = await GET_PAYROLL(
      new Request(`http://localhost/api/payroll/summary?month=${MONTH}`),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as PayrollPrep;
  }

  /** Chot ky CONG (khac chot luong) — dieu kien (1) cua `closePayroll`. */
  async function closePeriod(): Promise<void> {
    const { error } = await admin
      .from("periods")
      .upsert(
        {
          company_id: COMPANY_ID,
          start_date: PERIOD_START,
          end_date: "2015-06-30",
          status: "closed",
        },
        { onConflict: "company_id,start_date" },
      );
    if (error) throw new Error(`Không chốt được kỳ công: ${error.message}`);
  }

  beforeAll(async () => {
    const { data: createdUser, error: userError } =
      await admin.auth.admin.createUser({
        email: `test-run-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (userError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${userError?.message}`);
    }
    actorUserId = createdUser.user.id;

    const { error: companyError } = await admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiệp test chốt lương ${suffix}`,
      code: `RUN${suffix.slice(0, 5).toUpperCase()}`,
      industry: "services",
      size: "1-10",
      phone: "0900000000",
      address: "Test",
      accent: "indigo",
    });
    if (companyError) {
      throw new Error(`Không tạo được doanh nghiệp test: ${companyError.message}`);
    }
    await admin.from("company_settings").insert({
      company_id: COMPANY_ID,
      standard_days_per_month: 20,
      standard_hours_per_day: 8,
    });
    await admin.from("departments").insert({
      id: DEPARTMENT_ID,
      company_id: COMPANY_ID,
      name: "Phòng test chốt lương",
      description: "Test",
      manager_id: null,
      status: "active",
    });
    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test",
      code: "RUNT",
      start_time: "08:00",
      end_time: "16:00",
      break_minutes: 0,
      late_tolerance_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
      status: "active",
    });
    await admin.from("employees").insert({
      id: EMPLOYEE_ID,
      company_id: COMPANY_ID,
      code: "RUN001",
      full_name: "Người test chốt lương",
      email: `${EMPLOYEE_ID}@timeflow.test`,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male",
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Nhân viên kho",
      contract_type: "full_time",
      start_date: "2014-01-01",
      manager_id: null,
      shift_id: SHIFT_ID,
      work_location: "Văn phòng chính",
      status: "active",
      system_role: "employee",
      invitation_sent: false,
      can_view_payslip: false,
      can_check_in_remotely: false,
      user_id: null,
    });
    await admin.from("overtime_rules").insert({
      company_id: COMPANY_ID,
      rule_key: "weekday",
      multiplier: 1.5,
      effective_from: "2014-01-01",
    });
    await admin.from("employee_pay_rates").insert({
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      unit: "month",
      amount: MONTHLY_SALARY,
      effective_from: "2014-01-01",
    });

    const { data: checkInAt } = await admin.rpc("tf_local_instant", {
      p_date: WORK_DAY,
      p_time: "08:00:00",
    });
    const { data: checkOutAt } = await admin.rpc("tf_local_instant", {
      p_date: WORK_DAY,
      p_time: "16:00:00",
    });
    const { data: worked } = await admin.rpc("tf_worked_minutes", {
      p_check_in: checkInAt as string,
      p_check_out: checkOutAt as string,
      p_break_minutes: 0,
    });
    await admin.from("attendance_records").insert({
      id: `att-run-${suffix}`,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      work_date: WORK_DAY,
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

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  afterAll(async () => {
    await admin.from("payroll_runs").delete().eq("company_id", COMPANY_ID);
    await admin.from("periods").delete().eq("company_id", COMPANY_ID);
    // Ky da chot chan ca DELETE tren attendance_records (trigger 0021), nen
    // dong ky phai bi xoa TRUOC.
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.from("audit_log").delete().eq("actor_user_id", actorUserId);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. KỲ CÔNG chưa chốt -> từ chối chốt lương, kèm chỉ đường", async () => {
    await expect(closePayroll(MONTH)).rejects.toThrow(/Kỳ công tháng 06\/2015 chưa được chốt/);

    // Va khong ban chot nao duoc tao ra.
    const { count } = await admin
      .from("payroll_runs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", COMPANY_ID);
    expect(count).toBe(0);
  });

  it("2. còn dòng THIẾU MỨC LƯƠNG -> từ chối, thông điệp NÊU TÊN người thiếu", async () => {
    await closePeriod();

    await admin.from("employees").insert({
      id: EMPLOYEE_UNPAID,
      company_id: COMPANY_ID,
      code: "RUN002",
      full_name: "Người chưa khai lương",
      email: `${EMPLOYEE_UNPAID}@timeflow.test`,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male",
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Nhân viên kho",
      contract_type: "full_time",
      start_date: "2014-01-01",
      manager_id: null,
      shift_id: SHIFT_ID,
      work_location: "Văn phòng chính",
      status: "active",
      system_role: "employee",
      invitation_sent: false,
      can_view_payslip: false,
      can_check_in_remotely: false,
      user_id: null,
    });

    await expect(closePayroll(MONTH)).rejects.toThrow(
      /Người chưa khai lương \(chưa khai mức lương\)/,
    );

    // Go nguoi do ra de cac bai sau chot duoc.
    await admin.from("employees").delete().eq("id", EMPLOYEE_UNPAID);
  });

  it("3. chốt thành công -> số dòng bản chốt bằng số nhân viên, tổng khớp màn hình", async () => {
    const before = await readPayroll();
    expect(before.payrollStatus).toBe("open");
    const expectedTotal = before.rows.reduce(
      (sum, row) => sum + (row.netPay ?? 0),
      0,
    );

    const result = await closePayroll(MONTH);

    expect(result.lineCount).toBe(before.rows.length);
    expect(result.netPayTotal).toBe(expectedTotal);
    expect(result.netPayTotal).toBe(EXPECTED_NET);

    const { count } = await admin
      .from("payroll_lines")
      .select("id", { count: "exact", head: true })
      .eq("company_id", COMPANY_ID);
    expect(count).toBe(before.rows.length);
  });

  it("4. HAI NHÁNH ĐỌC trả CÙNG bộ số — chỉ khác `payrollStatus`", async () => {
    const after = await readPayroll();

    expect(after.payrollStatus).toBe("closed");
    expect(after.payrollClosedAt).not.toBeNull();
    expect(after.payrollClosedBy).toBe(actorUserId);

    const row = after.rows.find((item) => item.employeeId === EMPLOYEE_ID);
    expect(row?.netPay).toBe(EXPECTED_NET);
    expect(row?.basePay).toBe(1_000_000);
    expect(row?.workedDays).toBe(1);
    expect(row?.creditedDays).toBe(1);
    expect(row?.payUnit).toBe("month");
    expect(row?.payAmount).toBe(MONTHLY_SALARY);
    expect(row?.missing).toEqual([]);
  });

  it("5. BÀI KIỂM CHÍNH (D-42): đổi mức lương SAU KHI chốt -> con số kỳ đã chốt KHÔNG ĐỔI", async () => {
    // Khai mot muc luong moi GAP DOI, hieu luc tu TRUOC ky — neu duong doc
    // tinh lai tu cau hinh hien tai, con so se nhay len 2.000.000.
    await admin.from("employee_pay_rates").insert({
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ID,
      unit: "month",
      amount: MONTHLY_SALARY * 2,
      effective_from: "2014-06-01",
    });

    const after = await readPayroll();
    const row = after.rows.find((item) => item.employeeId === EMPLOYEE_ID);

    expect(after.payrollStatus).toBe("closed");
    expect(row?.payAmount).toBe(MONTHLY_SALARY);
    expect(row?.netPay).toBe(EXPECTED_NET);
    // Neu ban chot bi tinh lai, con so nay se la 2.000.000.
    expect(row?.netPay).not.toBe(EXPECTED_NET * 2);
  });

  it("6. chốt LẦN HAI -> từ chối", async () => {
    await expect(closePayroll(MONTH)).rejects.toThrow(/đã được chốt trước đó rồi/);
  });

  it("7. bản chốt KHÔNG SỬA ĐƯỢC, kể cả bằng khoá service_role", async () => {
    const { error } = await admin
      .from("payroll_lines")
      .update({ net_pay: 1 })
      .eq("company_id", COMPANY_ID);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("huỷ chốt lương cả kỳ");
  });

  it("8. huỷ chốt THIẾU LÝ DO -> từ chối; bản chốt vẫn còn nguyên", async () => {
    await expect(reopenPayroll(MONTH, "   ")).rejects.toThrow(
      /Vui lòng nêu lý do huỷ chốt lương/,
    );

    const { count } = await admin
      .from("payroll_runs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", COMPANY_ID);
    expect(count).toBe(1);
  });

  it("9. huỷ chốt KÈM LÝ DO -> xoá cả bản chốt, audit ghi lý do, bảng tính lại theo mức MỚI", async () => {
    await reopenPayroll(MONTH, "Khai nhầm mức lương của một người");

    const { count: runCount } = await admin
      .from("payroll_runs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", COMPANY_ID);
    const { count: lineCount } = await admin
      .from("payroll_lines")
      .select("id", { count: "exact", head: true })
      .eq("company_id", COMPANY_ID);

    // Xoa CA ban chot — dong luong di theo bang `on delete cascade`.
    expect(runCount).toBe(0);
    expect(lineCount).toBe(0);

    const { data: audit } = await admin
      .from("audit_log")
      .select("action, entity_table, reason")
      .eq("actor_user_id", actorUserId)
      .eq("entity_table", "payroll_runs")
      .eq("action", "delete")
      .maybeSingle();
    expect(audit?.reason).toBe("Khai nhầm mức lương của một người");

    // Bang quay ve tinh luc truy van, va lan nay theo muc luong MOI (gap doi).
    const after = await readPayroll();
    const row = after.rows.find((item) => item.employeeId === EMPLOYEE_ID);
    expect(after.payrollStatus).toBe("open");
    expect(row?.payAmount).toBe(MONTHLY_SALARY * 2);
    expect(row?.netPay).toBe(EXPECTED_NET * 2);
  });

  it("10. huỷ rồi CHỐT LẠI -> bản chốt mới, mang con số mới", async () => {
    const result = await closePayroll(MONTH);

    expect(result.netPayTotal).toBe(EXPECTED_NET * 2);

    const after = await readPayroll();
    expect(after.payrollStatus).toBe("closed");
    expect(
      after.rows.find((item) => item.employeeId === EMPLOYEE_ID)?.netPay,
    ).toBe(EXPECTED_NET * 2);
  });

  it("11. vai trò employee bị từ chối ở CẢ hai đường ghi (D-44)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session("employee"));

    await expect(closePayroll(MONTH)).rejects.toThrow(ForbiddenError);
    await expect(reopenPayroll(MONTH, "lý do")).rejects.toThrow(ForbiddenError);

    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  it("12. mỗi thao tác để lại đúng một dòng audit", async () => {
    const { data } = await admin
      .from("audit_log")
      .select("action")
      .eq("actor_user_id", actorUserId)
      .eq("entity_table", "payroll_runs");

    const rows = data ?? [];
    // Hai lan chot (bai 3 va bai 10) + mot lan huy (bai 9).
    expect(rows.filter((row) => row.action === "insert").length).toBe(2);
    expect(rows.filter((row) => row.action === "delete").length).toBe(1);
  });
});
