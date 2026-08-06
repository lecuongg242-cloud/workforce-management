// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as GET_PAYROLL } from "@/app/api/payroll/summary/route";
import { GET as GET_SUMMARY } from "@/app/api/attendance/summary/route";
import { getSessionContext } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import type { MonthlySummary, PayrollPrep } from "@/lib/types/domain";

/**
 * Bang chuan bi luong tren du lieu that.
 *
 * BAI KIEM QUAN TRONG NHAT la bai doi chieu: voi CUNG mot nhan vien va CUNG
 * mot thang, moi con so cua `GET /api/payroll/summary` phai TRUNG KHIT voi
 * `GET /api/attendance/summary`. Hai duong doc do phuc vu hai man hinh khac
 * nhau; neu chung lech nhau thi ke toan va quan tri se cai nhau ve mot con so
 * ma khong ai biet ben nao dung — dung loai hong hoc ma `month-context.ts`
 * duoc tach ra de ngan.
 *
 * Hai bai con lai giu hai quy tac de mat nhat: nguoi khong co ban ghi van co
 * mot dong (toan so 0), va nguoi da nghi viec van co mat NEU thang do ho co
 * lam.
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

/** Thang co dinh trong qua khu. Ca test: Thu Hai–Thu Sau, 08:00–16:00. */
const MONTH = "2013-03";
const WORK_DAY_1 = "2013-03-04"; // Thu Hai
const WORK_DAY_2 = "2013-03-05"; // Thu Ba
const LEAVE_DAY = "2013-03-06"; // Thu Tu

describe("Bảng chuẩn bị lương (GET /api/payroll/summary)", () => {
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
  const COMPANY_ID = `cty-pay-${suffix}`;
  const DEPARTMENT_ID = `dept-pay-${suffix}`;
  const SHIFT_ID = `sft-pay-${suffix}`;
  /** Co ban ghi trong thang. */
  const EMPLOYEE_ACTIVE = `emp-pay-${suffix}-a`;
  /** Dang lam viec nhung KHONG co ban ghi nao trong thang. */
  const EMPLOYEE_IDLE = `emp-pay-${suffix}-b`;
  /** DA NGHI VIEC nhung co ban ghi trong thang. */
  const EMPLOYEE_LEFT = `emp-pay-${suffix}-c`;
  /** DA NGHI VIEC va khong co ban ghi nao. */
  const EMPLOYEE_LEFT_IDLE = `emp-pay-${suffix}-d`;

  let actorUserId = "";

  function session(role: "owner" | "employee" = "owner") {
    return {
      userId: actorUserId,
      email: `test-payroll-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role,
      employeeId: EMPLOYEE_ACTIVE,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  async function readPayroll(month = MONTH): Promise<PayrollPrep> {
    const response = await GET_PAYROLL(
      new Request(`http://localhost/api/payroll/summary?month=${month}`),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as PayrollPrep;
  }

  async function readEmployeeSummary(employeeId: string): Promise<MonthlySummary> {
    const response = await GET_SUMMARY(
      new Request(
        `http://localhost/api/attendance/summary?employeeId=${employeeId}&month=${MONTH}`,
      ),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as MonthlySummary;
  }

  /** Mot ngay lam viec that: vao 08:00, ra `checkOut`. */
  async function insertDay(
    employeeId: string,
    date: string,
    checkOut: string,
  ): Promise<void> {
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
      id: `att-pay-${suffix}-${employeeId.slice(-1)}-${date}`,
      company_id: COMPANY_ID,
      employee_id: employeeId,
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
    const { data: createdUser, error: userError } =
      await admin.auth.admin.createUser({
        email: `test-payroll-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (userError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${userError?.message}`);
    }
    actorUserId = createdUser.user.id;

    const { error: companyError } = await admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiệp test bảng lương ${suffix}`,
      code: `PAY${suffix.slice(0, 5).toUpperCase()}`,
      industry: "services",
      size: "1-10",
      phone: "0900000000",
      address: "Test",
      accent: "indigo",
    });
    if (companyError) {
      throw new Error(`Không tạo được doanh nghiệp test: ${companyError.message}`);
    }
    await admin.from("company_settings").insert({ company_id: COMPANY_ID });
    await admin.from("departments").insert({
      id: DEPARTMENT_ID,
      company_id: COMPANY_ID,
      name: "Phòng test lương",
      description: "Test",
      manager_id: null,
      status: "active",
    });
    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test",
      code: "PAYT",
      start_time: "08:00",
      end_time: "16:00",
      break_minutes: 0,
      late_tolerance_minutes: 0,
      working_days: [1, 2, 3, 4, 5],
      status: "active",
    });

    const base = {
      company_id: COMPANY_ID,
      phone: "0900000000",
      date_of_birth: "1990-01-01",
      gender: "male" as const,
      avatar_url: null,
      department_id: DEPARTMENT_ID,
      position: "Test",
      contract_type: "full_time" as const,
      start_date: "2012-01-01",
      manager_id: null,
      shift_id: SHIFT_ID,
      work_location: "Văn phòng chính",
      system_role: "employee" as const,
      invitation_sent: false,
      can_view_payslip: false,
      can_check_in_remotely: false,
      user_id: null,
    };

    await admin.from("employees").insert([
      { ...base, id: EMPLOYEE_ACTIVE, code: "PAY001", full_name: "Người có công", email: `${EMPLOYEE_ACTIVE}@timeflow.test`, status: "active" },
      { ...base, id: EMPLOYEE_IDLE, code: "PAY002", full_name: "Người không có công", email: `${EMPLOYEE_IDLE}@timeflow.test`, status: "active" },
      { ...base, id: EMPLOYEE_LEFT, code: "PAY003", full_name: "Người đã nghỉ việc có công", email: `${EMPLOYEE_LEFT}@timeflow.test`, status: "terminated" },
      { ...base, id: EMPLOYEE_LEFT_IDLE, code: "PAY004", full_name: "Người đã nghỉ việc không công", email: `${EMPLOYEE_LEFT_IDLE}@timeflow.test`, status: "terminated" },
    ]);

    // He so tang ca de `convertedOvertimeHours` la mot con so, khong phai null.
    await admin.from("overtime_rules").insert({
      company_id: COMPANY_ID,
      rule_key: "weekday",
      multiplier: 1.5,
      effective_from: "2013-01-01",
    });

    // Nguoi co cong: mot ngay du 8 tieng, mot ngay lam den 18:00 (600 phut ->
    // 120 phut tang ca), va mot ngay nghi phep.
    await insertDay(EMPLOYEE_ACTIVE, WORK_DAY_1, "16:00:00");
    await insertDay(EMPLOYEE_ACTIVE, WORK_DAY_2, "18:00:00");
    await admin.from("attendance_records").insert({
      id: `att-pay-${suffix}-leave`,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_ACTIVE,
      work_date: LEAVE_DAY,
      shift_id: SHIFT_ID,
      check_in_at: null,
      check_out_at: null,
      worked_minutes: 0,
      late_minutes: 0,
      early_leave_minutes: 0,
      status: "leave_paid",
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    });

    // Nguoi da nghi viec nhung thang do co lam mot ngay.
    await insertDay(EMPLOYEE_LEFT, WORK_DAY_1, "16:00:00");

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  afterAll(async () => {
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. mọi con số TRÙNG KHÍT với GET /api/attendance/summary của cùng nhân viên", async () => {
    const payroll = await readPayroll();
    const row = payroll.rows.find((item) => item.employeeId === EMPLOYEE_ACTIVE);
    const summary = await readEmployeeSummary(EMPLOYEE_ACTIVE);

    expect(row).toBeDefined();
    expect(row?.workedDays).toBe(summary.workedDays);
    expect(row?.totalMinutes).toBe(summary.totalMinutes);
    expect(row?.leaveDays).toBe(summary.leaveDays);
    expect(row?.lateCount).toBe(summary.lateCount);
    expect(row?.overtimeMinutes).toBe(summary.overtimeMinutes);
    expect(row?.convertedOvertimeHours).toBe(summary.convertedOvertimeHours);
  });

  it("2. con số là số THẬT, không phải 0 trùng khớp một cách vô nghĩa", async () => {
    const payroll = await readPayroll();
    const row = payroll.rows.find((item) => item.employeeId === EMPLOYEE_ACTIVE);

    // 2 ngay lam (480 + 600 phut), 1 ngay nghi phep, 120 phut tang ca.
    expect(row?.workedDays).toBe(2);
    expect(row?.totalMinutes).toBe(1080);
    expect(row?.leaveDays).toBe(1);
    expect(row?.overtimeMinutes).toBe(120);
    // 120 phut x 1.5 / 60 = 3 gio quy doi.
    expect(row?.convertedOvertimeHours).toBe(3);
  });

  it("3. nhân viên KHÔNG có bản ghi nào vẫn có một dòng toàn số 0", async () => {
    const payroll = await readPayroll();
    const row = payroll.rows.find((item) => item.employeeId === EMPLOYEE_IDLE);

    // Bo ho di se lam ke toan tuong danh sach thieu nguoi.
    expect(row).toBeDefined();
    expect(row?.workedDays).toBe(0);
    expect(row?.totalMinutes).toBe(0);
    expect(row?.convertedOvertimeHours).toBe(0);
  });

  it("4. người ĐÃ NGHỈ VIỆC vẫn có mặt NẾU tháng đó họ có làm; nghỉ việc và không làm thì không", async () => {
    const payroll = await readPayroll();
    const ids = payroll.rows.map((row) => row.employeeId);

    expect(ids).toContain(EMPLOYEE_LEFT);
    expect(ids).not.toContain(EMPLOYEE_LEFT_IDLE);
  });

  it("5. mang ngữ cảnh phòng ban, và trạng thái kỳ là null khi kỳ chưa được tạo", async () => {
    const payroll = await readPayroll();
    const row = payroll.rows.find((item) => item.employeeId === EMPLOYEE_ACTIVE);

    expect(row?.departmentName).toBe("Phòng test lương");
    expect(row?.employeeCode).toBe("PAY001");
    // Ky chua ton tai — khac `open`, va giao dien noi hai dieu khac nhau.
    expect(payroll.periodStatus).toBeNull();
  });

  it("6. tháng không có dữ liệu -> vẫn trả danh sách nhân viên với số 0, không lỗi", async () => {
    const payroll = await readPayroll("2013-04");

    expect(payroll.month).toBe("2013-04");
    expect(payroll.rows.length).toBeGreaterThan(0);
    expect(payroll.rows.every((row) => row.workedDays === 0)).toBe(true);
    // Nguoi da nghi viec khong co ban ghi thang nay -> khong con trong danh sach.
    expect(payroll.rows.map((row) => row.employeeId)).not.toContain(EMPLOYEE_LEFT);
  });

  it("7. vai trò employee bị từ chối (403) — bảng này gộp số liệu của cả doanh nghiệp", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session("employee"));

    const response = await GET_PAYROLL(
      new Request(`http://localhost/api/payroll/summary?month=${MONTH}`),
    );
    expect(response.status).toBe(403);

    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  it("8. tháng sai định dạng -> 400 với thông điệp tiếng Việt", async () => {
    const response = await GET_PAYROLL(
      new Request("http://localhost/api/payroll/summary?month=2013-13"),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("YYYY-MM");
  });
});
