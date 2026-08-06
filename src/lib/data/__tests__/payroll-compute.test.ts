// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT: `createServerSupabase` mock ve client
// dung `SUPABASE_SECRET_KEY`, `getSessionContext` mock de dong vai phien.
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as GET_PAYROLL } from "@/app/api/payroll/summary/route";
import { getSessionContext } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PayrollPrep, PayrollPrepRow, WorkMode } from "@/lib/types/domain";

/**
 * SO TIEN tren du lieu that (PAY-01). Day la bai kiem ma ca phase ton tai vi
 * no: test so GIO dung khong chung minh duoc so TIEN dung.
 *
 * ======================================================================
 * BO SO, VA PHEP TINH TAY DAY DU
 * ======================================================================
 *
 * Cau hinh doanh nghiep test:
 *   ca 08:00-16:00 (480 phut/ngay), khong nghi giua ca
 *   standard_days_per_month = 20 ; standard_hours_per_day = 8
 *   he so tang ca ngay thuong = 1,5
 *   muc luong = 20.000.000 dong/thang
 *     -> don gia ngay = 20.000.000 / 20 =  1.000.000
 *     -> don gia gio  =  1.000.000 /  8 =    125.000
 *
 * Tap cham cong (thang 05/2014, ca lam Thu Hai-Thu Sau):
 *   05/05 Thu Hai  08:00-16:00  -> 480 phut (dung ca)
 *   06/05 Thu Ba   08:00-20:00  -> 720 phut (vuot ca 240; vuot ngay chuan 240)
 *   07/05 Thu Tu   08:00-12:00  -> 240 phut (thieu ca 240)
 *   08/05 Thu Nam  leave_paid
 *   09/05 Thu Sau  leave_unpaid
 *
 *   Tong gio lam = 1.440 phut = 24 gio.
 *
 * --- Che do `shift` -------------------------------------------------------
 *   creditedDays  = 3 ngay lam + 1 leave_paid            = 4
 *   overtime      = 240 phut (chi ngay 06/05 vuot ca)
 *   gio quy doi   = 240 x 1,5 / 60                       = 6 gio
 *   luong goc     = 1.000.000 x 4                        = 4.000.000
 *   tien tang ca  =   125.000 x 6                        =   750.000
 *   THUC NHAN                                            = 4.750.000
 *
 * --- Che do `daily_hours` (ngay chuan 8 gio) ------------------------------
 *   regularMinutes = 480 + 480 + 240                     = 1.200 phut = 20 gio
 *   creditedDays   = 1 + 1 + 0,5 + 1 (leave_paid)        = 3,5
 *   overtime       = 240 phut (ngay 06/05 vuot 8 gio)
 *   gio quy doi    = 6 gio (nhu tren)
 *   luong goc      = 125.000 x 20                        = 2.500.000
 *   tien tang ca   = 125.000 x 6                         =   750.000
 *   THUC NHAN                                            = 3.250.000
 *
 * --- Che do `shift_hourly` ------------------------------------------------
 *   creditedDays  = 4 (nhu `shift`)
 *   hourDelta     = (480-480) + (720-480) + (240-480)    = 0 phut
 *   luong goc     = 4.000.000 ; lech gio = 0 ; tang ca   =   750.000
 *   THUC NHAN                                            = 4.750.000
 *
 *   `shift` va `shift_hourly` TRUNG NHAU o bo so nay — do la mot su that cua
 *   bo so (thua 240 phut mot ngay, thieu 240 phut mot ngay khac, bu tru het),
 *   khong phai mot che do chua duoc noi vao. Bai 6 tach hai che do do ra bang
 *   mot ngay cham cong THU SAU pha the bu tru.
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

const MONTH = "2014-05";
const DAY_FULL = "2014-05-05"; // Thu Hai
const DAY_LONG = "2014-05-06"; // Thu Ba
const DAY_SHORT = "2014-05-07"; // Thu Tu
const DAY_LEAVE_PAID = "2014-05-08"; // Thu Nam
const DAY_LEAVE_UNPAID = "2014-05-09"; // Thu Sau
const DAY_EXTRA = "2014-05-12"; // Thu Hai tuan sau — chi dung o bai 6

const DAYS_PER_MONTH = 20;
const HOURS_PER_DAY = 8;
const MONTHLY_SALARY = 20_000_000;
const DAILY_RATE = 1_000_000;
const HOURLY_RATE = 125_000;

describe("Số tiền của bảng lương trên database thật (PAY-01)", () => {
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
  const COMPANY_ID = `cty-pc-${suffix}`;
  const DEPARTMENT_ID = `dept-pc-${suffix}`;
  const SHIFT_ID = `sft-pc-${suffix}`;
  /** Da khai muc luong. */
  const EMPLOYEE_PAID = `emp-pc-${suffix}-a`;
  /** CHUA khai muc luong — nam cung bang voi nguoi tren. */
  const EMPLOYEE_UNPAID = `emp-pc-${suffix}-b`;

  let actorUserId = "";

  function session() {
    return {
      userId: actorUserId,
      email: `test-payroll-compute-${suffix}@timeflow.test`,
      companyId: COMPANY_ID,
      role: "owner" as const,
      employeeId: EMPLOYEE_PAID,
      isPlatformAdmin: false,
      mustChangePassword: false,
    };
  }

  async function readWithMode(
    mode: WorkMode,
  ): Promise<{ prep: PayrollPrep; paid: PayrollPrepRow; unpaid: PayrollPrepRow }> {
    const { error } = await admin
      .from("company_settings")
      .update({ work_mode: mode })
      .eq("company_id", COMPANY_ID);
    if (error) throw new Error(`Không đặt được chế độ: ${error.message}`);

    const response = await GET_PAYROLL(
      new Request(`http://localhost/api/payroll/summary?month=${MONTH}`),
    );
    expect(response.status).toBe(200);
    const prep = (await response.json()) as PayrollPrep;
    const paid = prep.rows.find((row) => row.employeeId === EMPLOYEE_PAID);
    const unpaid = prep.rows.find((row) => row.employeeId === EMPLOYEE_UNPAID);
    if (!paid || !unpaid) throw new Error("Thiếu dòng của nhân viên test.");
    return { prep, paid, unpaid };
  }

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
      id: `att-pc-${suffix}-${employeeId.slice(-1)}-${date}`,
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

  async function insertLeave(
    date: string,
    status: "leave_paid" | "leave_unpaid",
  ): Promise<void> {
    const { error } = await admin.from("attendance_records").insert({
      id: `att-pc-${suffix}-a-${date}`,
      company_id: COMPANY_ID,
      employee_id: EMPLOYEE_PAID,
      work_date: date,
      shift_id: SHIFT_ID,
      check_in_at: null,
      check_out_at: null,
      worked_minutes: 0,
      late_minutes: 0,
      early_leave_minutes: 0,
      status,
      location: "Văn phòng chính",
      needs_supplement: false,
      note: null,
    });
    if (error) throw new Error(`Không tạo được ngày nghỉ ${date}: ${error.message}`);
  }

  beforeAll(async () => {
    const { data: createdUser, error: userError } =
      await admin.auth.admin.createUser({
        email: `test-payroll-compute-${suffix}@timeflow.test`,
        password: randomUUID(),
        email_confirm: true,
      });
    if (userError || !createdUser.user) {
      throw new Error(`Không tạo được auth user test: ${userError?.message}`);
    }
    actorUserId = createdUser.user.id;

    const { error: companyError } = await admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiệp test tiền lương ${suffix}`,
      code: `PC${suffix.slice(0, 6).toUpperCase()}`,
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
      standard_days_per_month: DAYS_PER_MONTH,
      standard_hours_per_day: HOURS_PER_DAY,
    });
    await admin.from("departments").insert({
      id: DEPARTMENT_ID,
      company_id: COMPANY_ID,
      name: "Phòng test tiền lương",
      description: "Test",
      manager_id: null,
      status: "active",
    });
    await admin.from("shifts").insert({
      id: SHIFT_ID,
      company_id: COMPANY_ID,
      name: "Ca test",
      code: "PCT",
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
      position: "Nhân viên kho",
      contract_type: "full_time" as const,
      start_date: "2013-01-01",
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
      { ...base, id: EMPLOYEE_PAID, code: "PC001", full_name: "Người đã khai lương", email: `${EMPLOYEE_PAID}@timeflow.test` },
      { ...base, id: EMPLOYEE_UNPAID, code: "PC002", full_name: "Người chưa khai lương", email: `${EMPLOYEE_UNPAID}@timeflow.test` },
    ]);

    await admin.from("overtime_rules").insert({
      company_id: COMPANY_ID,
      rule_key: "weekday",
      multiplier: 1.5,
      effective_from: "2013-01-01",
    });

    // Muc luong hieu luc TU TRUOC ky — chi mot nguoi duoc khai.
    //
    // HAI phien ban CUNG MOT muc tien, moc som hon (2012-01-01) co mat de bai
    // 9 dung duoc: bai do hoi mot thang thang 12/2012 de tao truong hop THIEU
    // HE SO tang ca (he so chi hieu luc tu 2013-01-01), va no can nguoi do DA
    // CO luong o thang do — neu khong, dong se `null` vi `pay_rate` chu khong
    // vi thieu he so, va bai kiem se do nham ly do.
    await admin.from("employee_pay_rates").insert([
      {
        company_id: COMPANY_ID,
        employee_id: EMPLOYEE_PAID,
        unit: "month",
        amount: MONTHLY_SALARY,
        effective_from: "2012-01-01",
      },
      {
        company_id: COMPANY_ID,
        employee_id: EMPLOYEE_PAID,
        unit: "month",
        amount: MONTHLY_SALARY,
        effective_from: "2013-01-01",
      },
    ]);

    await insertDay(EMPLOYEE_PAID, DAY_FULL, "16:00:00");
    await insertDay(EMPLOYEE_PAID, DAY_LONG, "20:00:00");
    await insertDay(EMPLOYEE_PAID, DAY_SHORT, "12:00:00");
    await insertLeave(DAY_LEAVE_PAID, "leave_paid");
    await insertLeave(DAY_LEAVE_UNPAID, "leave_unpaid");

    vi.mocked(createServerSupabase).mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
    vi.mocked(getSessionContext).mockResolvedValue(session());
  });

  afterAll(async () => {
    await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
    await admin.from("pay_adjustments").delete().eq("company_id", COMPANY_ID);
    await admin.auth.admin.deleteUser(actorUserId);
  });

  it("1. chế độ `shift` — số tiền khớp phép tính tay ghi ở đầu file", async () => {
    const { paid } = await readWithMode("shift");

    expect(paid.creditedDays).toBe(4);
    expect(paid.basePay).toBe(DAILY_RATE * 4);
    expect(paid.basePay).toBe(4_000_000);
    expect(paid.convertedOvertimeHours).toBe(6);
    expect(paid.overtimePay).toBe(HOURLY_RATE * 6);
    expect(paid.overtimePay).toBe(750_000);
    expect(paid.netPay).toBe(4_750_000);
    expect(paid.missing).toEqual([]);
  });

  it("2. chế độ `daily_hours` — trả theo GIỜ THỰC TẾ (D-39), số tiền khớp phép tính tay", async () => {
    const { paid } = await readWithMode("daily_hours");

    // 1.200 phut thuong = 20 gio -> 125.000 x 20 = 2.500.000
    expect(paid.regularMinutes).toBe(1_200);
    expect(paid.basePay).toBe(HOURLY_RATE * 20);
    expect(paid.basePay).toBe(2_500_000);
    expect(paid.creditedDays).toBe(3.5);
    expect(paid.netPay).toBe(3_250_000);
  });

  it("3. chế độ `shift_hourly` — số tiền khớp phép tính tay", async () => {
    const { paid } = await readWithMode("shift_hourly");

    expect(paid.basePay).toBe(4_000_000);
    // Thua 240 phut mot ngay, thieu 240 phut mot ngay khac -> bu tru het.
    expect(paid.hourDeltaMinutes).toBe(0);
    expect(paid.hourAdjustment).toBe(0);
    expect(paid.netPay).toBe(4_750_000);
  });

  it("4. BA CHẾ ĐỘ, cùng một tập chấm công và cùng một mức lương -> tiền KHÁC nhau", async () => {
    const shift = (await readWithMode("shift")).paid;
    const dailyHours = (await readWithMode("daily_hours")).paid;

    // `daily_hours` tra theo gio thuc te nen nguoi lam thieu gio nhan it hon
    // 1,5 trieu — do la dung dinh nghia cua che do, khong phai mot loi.
    expect(shift.netPay).toBe(4_750_000);
    expect(dailyHours.netPay).toBe(3_250_000);
    expect(shift.netPay).not.toBe(dailyHours.netPay);
  });

  it("5. người CHƯA KHAI mức lương -> dòng của họ `null`, dòng người kia VẪN ra số", async () => {
    const { paid, unpaid } = await readWithMode("shift");

    expect(unpaid.netPay).toBeNull();
    expect(unpaid.basePay).toBeNull();
    // KHONG phai 0 — mot so 0 doc nhu "nguoi nay khong duoc tra gi".
    expect(unpaid.netPay).not.toBe(0);
    expect(unpaid.missing).toContain("pay_rate");

    // Mot dong thieu du kien thi thieu MOT MINH NO.
    expect(paid.netPay).toBe(4_750_000);
  });

  it("6. `shift_hourly` TÁCH KHỎI `shift` khi thế bù trừ bị phá", async () => {
    // Them mot ngay lam THIEU 240 phut nua -> hourDelta = -240 phut = -4 gio.
    await insertDay(EMPLOYEE_PAID, DAY_EXTRA, "12:00:00");

    const shift = (await readWithMode("shift")).paid;
    const shiftHourly = (await readWithMode("shift_hourly")).paid;

    // `shift` dem NGAY: them mot ngay lam la them tron mot ngay cong.
    expect(shift.creditedDays).toBe(5);
    expect(shift.basePay).toBe(5_000_000);
    expect(shift.netPay).toBe(5_750_000);

    // `shift_hourly` cung dem ngay, nhung TRU phan gio thieu:
    // 5.000.000 + 125.000 x (-4) = 5.000.000 - 500.000 = 4.500.000
    expect(shiftHourly.hourDeltaMinutes).toBe(-240);
    expect(shiftHourly.hourAdjustment).toBe(-500_000);
    expect(shiftHourly.netPay).toBe(4_500_000 + 750_000);
    expect(shiftHourly.netPay).not.toBe(shift.netPay);

    // Don dep de cac bai sau khong bi anh huong.
    await admin
      .from("attendance_records")
      .delete()
      .eq("company_id", COMPANY_ID)
      .eq("work_date", DAY_EXTRA);
  });

  it("7. phụ cấp và khấu trừ đi vào con số, và bảng ĐỐI CHIẾU ĐƯỢC", async () => {
    const { data: allowance } = await admin
      .from("pay_adjustments")
      .insert({
        company_id: COMPANY_ID,
        name: "Phụ cấp ăn trưa",
        kind: "allowance",
        value_type: "fixed_amount",
        value: 730_000,
      })
      .select("id")
      .single();
    await admin.from("pay_adjustment_scopes").insert({
      company_id: COMPANY_ID,
      adjustment_id: (allowance as { id: string }).id,
      mode: "include",
      scope_type: "company",
      scope_value: null,
    });

    const { data: deduction } = await admin
      .from("pay_adjustments")
      .insert({
        company_id: COMPANY_ID,
        name: "Trừ 10% lương ngày",
        kind: "deduction",
        value_type: "percent_of_daily_wage",
        value: 10,
      })
      .select("id")
      .single();
    await admin.from("pay_adjustment_scopes").insert({
      company_id: COMPANY_ID,
      adjustment_id: (deduction as { id: string }).id,
      mode: "include",
      scope_type: "company",
      scope_value: null,
    });

    const { paid } = await readWithMode("shift");

    // 10% x 1.000.000 (LUONG NGAY, khong phai luong thang) = 100.000
    expect(paid.allowanceTotal).toBe(730_000);
    expect(paid.deductionTotal).toBe(100_000);
    // 4.000.000 + 750.000 + 0 + 730.000 - 100.000 = 5.380.000
    expect(paid.netPay).toBe(5_380_000);

    // BANG PHAI DOI CHIEU DUOC: thuc nhan bang dung tong cac o hien ra.
    expect(paid.netPay).toBe(
      (paid.basePay as number) +
        (paid.overtimePay as number) +
        (paid.hourAdjustment as number) +
        (paid.allowanceTotal as number) -
        (paid.deductionTotal as number),
    );
    // Va tong khoan bang dung tong cac dong khoan.
    expect(paid.allowanceTotal).toBe(
      paid.allowanceItems.reduce((sum, item) => sum + item.amount, 0),
    );
  });

  it("8. KHOẢN NGOÀI PHẠM VI không đi vào con số của người không thuộc phạm vi", async () => {
    const { data: scoped } = await admin
      .from("pay_adjustments")
      .insert({
        company_id: COMPANY_ID,
        name: "Phụ cấp riêng một người",
        kind: "allowance",
        value_type: "fixed_amount",
        value: 500_000,
      })
      .select("id")
      .single();
    await admin.from("pay_adjustment_scopes").insert({
      company_id: COMPANY_ID,
      adjustment_id: (scoped as { id: string }).id,
      mode: "include",
      scope_type: "employee",
      scope_value: EMPLOYEE_UNPAID,
    });

    const { paid } = await readWithMode("shift");

    // Khoan chi ap cho nguoi kia -> con so cua nguoi nay khong doi.
    expect(paid.netPay).toBe(5_380_000);
    expect(paid.allowanceItems.map((item) => item.name)).not.toContain(
      "Phụ cấp riêng một người",
    );
  });

  it("9. THIẾU HỆ SỐ tăng ca -> tiền tăng ca và thực nhận `null`, KHÔNG phải tổng phần đã biết", async () => {
    // Thang 06/2014 khong co ban ghi nao -> khong co tang ca -> khong thieu he
    // so. Nen de tao truong hop thieu, dung mot doanh nghiep chua khai he so:
    // o day ta doi bang cach hoi mot thang ma he so CHUA hieu luc.
    await admin
      .from("company_settings")
      .update({ work_mode: "shift" })
      .eq("company_id", COMPANY_ID);

    // He so `weekday` hieu luc tu 2013-01-01. Mot ngay cong TRUOC moc do se
    // khong co he so (D-26). Tao mot ban ghi thang 12/2012 co tang ca.
    await insertDay(EMPLOYEE_PAID, "2012-12-03", "20:00:00");

    const response = await GET_PAYROLL(
      new Request("http://localhost/api/payroll/summary?month=2012-12"),
    );
    const prep = (await response.json()) as PayrollPrep;
    const row = prep.rows.find((item) => item.employeeId === EMPLOYEE_PAID);

    expect(row?.convertedOvertimeHours).toBeNull();
    expect(row?.overtimePay).toBeNull();
    // Luong goc VAN tinh duoc (1 ngay cong = 1.000.000) nhung TONG thi khong —
    // cong phan da biet lai roi trinh bay nhu mot con so day du la cach tao ra
    // mot con so SAI ma trong hoan toan dung.
    expect(row?.basePay).toBe(1_000_000);
    expect(row?.netPay).toBeNull();
    expect(row?.missing).toContain("overtime_rule:weekday");

    await admin
      .from("attendance_records")
      .delete()
      .eq("company_id", COMPANY_ID)
      .eq("work_date", "2012-12-03");
  });

  it("10. THIẾU MẪU SỐ quy đổi -> `null` kèm lý do, không đoán (D-38)", async () => {
    await admin
      .from("company_settings")
      .update({ standard_days_per_month: null })
      .eq("company_id", COMPANY_ID);

    const { paid } = await readWithMode("shift");

    expect(paid.basePay).toBeNull();
    expect(paid.netPay).toBeNull();
    expect(paid.missing).toContain("standard_days_per_month");

    // Dat lai de bai sau khong bi anh huong, va de chung minh so lieu quay ve
    // dung khi mau so duoc khai lai.
    await admin
      .from("company_settings")
      .update({ standard_days_per_month: DAYS_PER_MONTH })
      .eq("company_id", COMPANY_ID);

    const { paid: after } = await readWithMode("shift");
    expect(after.netPay).toBe(5_380_000);
  });
});
