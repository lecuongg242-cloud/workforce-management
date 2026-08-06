/**
 * e2e-payroll.mjs — MOT KY LUONG DAY DU, qua HTTP that
 * (Phase 5.2, plan 05-2-06 Task 2).
 *
 * Cau hoi no tra loi: mot ky luong di tu luc khai muc luong den luc chot roi
 * huy chot — co chay duoc mot lan dau-cuoi tren he thong that khong, va ban
 * chot co that su tu chua khong?
 *
 * SAU DIEU NO CHUNG MINH, VA MOT DIEU NO KHONG:
 *   1. Bang luong ra SO TIEN qua HTTP that, bang cookie quan tri that.
 *   2. Nguoi CHUA KHAI MUC LUONG co dong `null` kem `missing: ["pay_rate"]` —
 *      khong phai 0 dong — va dong cua nguoi khac VAN ra so.
 *   3. Nguoi bi LOAI TRU khoi pham vi phu cap khong nhan khoan do, trong khi
 *      nhung nguoi con lai thi co (D-40).
 *   4. Chot luong khi KY CONG chua chot -> bi tu choi.
 *   5. Chot luong -> ban chot co dung so dong, va TONG bang tong cac dong.
 *   6. **Doi muc luong -> con so cua ky da chot KHONG DOI; huy chot -> con so
 *      DOI THEO muc moi.** Hai buoc nay lien nhau va cho hai ket qua NGUOC
 *      NHAU — do la bang chung ban chot that su tu chua (D-42), khong phai mot
 *      lan doc lai tinh co ra dung so cu.
 *
 *   7. NO KHONG CHUNG MINH DUONG GHI CUA TANG UNG DUNG. Moi thao tac ghi cua
 *      du an la Server Action (D-12c), va Server Action khong goi duoc tu mot
 *      script ngoai — gioi han nay da duoc ghi tu 04-06 va 05-06. Cac buoc GHI
 *      o day goi THANG cac lenh ma Server Action goi, va duoc danh dau ro bang
 *      `[mo phong ghi]`. Ban than `closePayroll()`/`reopenPayroll()` duoc phu
 *      boi test tich hop chay tren database that (`payroll-run.test.ts`).
 *
 * Chay:
 *   npm run dev -- -p 3009
 *   TF_BASE_URL=http://localhost:3009 npm run test:e2e-payroll
 *
 * ======================================================================
 * BO SO, VA PHEP TINH TAY DAY DU
 * ======================================================================
 *
 * Ca 08:00-16:00 (480 phut), 20 ngay cong chuan, 8 gio/ngay, he so ngay
 * thuong 1,5. Che do `shift`.
 *
 * Muc luong: An va Binh 20.000.000/thang -> don gia ngay 1.000.000,
 * don gia gio 125.000. Cuong CHUA KHAI.
 *
 * Cham cong thang 05/2016 (moi nguoi giong nhau):
 *   02/05 Thu Hai  08:00-16:00 -> 480 phut (du ca)
 *   03/05 Thu Ba   08:00-20:00 -> 720 phut (vuot ca 240 phut)
 *   04/05 Thu Tu   08:00-12:00 -> 240 phut (thieu ca, che do `shift` van 1 ngay)
 *   05/05 Thu Nam  leave_unpaid          (KHONG duoc tinh ngay cong, D-43)
 *
 *   -> creditedDays = 3 ; overtime = 240 phut -> 6 gio quy doi
 *   -> luong goc    = 1.000.000 x 3 = 3.000.000
 *   -> tien tang ca =   125.000 x 6 =   750.000
 *
 * Khoan:
 *   phu cap "Xang xe" 500.000, toan cong ty TRU Binh
 *   phat di muon 100.000 moi lan — khong ai di muon nen bang 0
 *
 *   An   -> 3.000.000 + 750.000 + 500.000 = 4.250.000
 *   Binh -> 3.000.000 + 750.000 +       0 = 3.750.000
 *   Cuong -> null (chua khai muc luong)
 *
 * Sau khi chot, muc luong cua An duoc khai GAP DOI (40.000.000):
 *   -> neu tinh lai: 6.000.000 + 1.500.000 + 500.000 = 8.000.000
 *   -> ban chot phai VAN la 4.250.000
 */

import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const BASE = process.env.TF_BASE_URL || "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !pub || !secret) {
  console.error(
    "Thieu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY",
  );
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const suffix = randomUUID().slice(0, 8);
const COMPANY_ID = `cty-e2ep-${suffix}`;
const DEPARTMENT_ID = `dept-e2ep-${suffix}`;
const SHIFT_ID = `sft-e2ep-${suffix}`;
const EMP_AN = `emp-e2ep-${suffix}-an`;
const EMP_BINH = `emp-e2ep-${suffix}-binh`;
const EMP_CUONG = `emp-e2ep-${suffix}-cuong`;
const ADMIN_EMAIL = `e2e-payroll-adm-${suffix}@timeflow.test`;
const PASSWORD = `Tf!${randomUUID()}`;

const MONTH = "2016-05";
const PERIOD_START = "2016-05-01";
const DAY_FULL = "2016-05-02"; // Thu Hai
const DAY_LONG = "2016-05-03"; // Thu Ba
const DAY_SHORT = "2016-05-04"; // Thu Tu
const DAY_LEAVE = "2016-05-05"; // Thu Nam

const MONTHLY_SALARY = 20_000_000;
const EXPECTED_AN = 4_250_000;
const EXPECTED_BINH = 3_750_000;
const EXPECTED_AN_AFTER_RAISE = 8_000_000;

let failures = 0;
const createdUserIds = [];

function check(label, condition, detail) {
  if (condition) {
    console.log(`  OK   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function step(title) {
  console.log(`\n${title}`);
}

/** Cookie phien theo dung khuon `@supabase/ssr` ma middleware cua app doc. */
async function signInCookie(email) {
  const anon = createClient(url, pub, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Khong dang nhap duoc ${email}: ${error?.message}`);
  }
  const ref = new URL(url).hostname.split(".")[0];
  const value = `base64-${Buffer.from(
    JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: "bearer",
      user: data.session.user,
    }),
  ).toString("base64")}`;
  return `sb-${ref}-auth-token=${value}; tf_active_company=${COMPANY_ID}`;
}

async function getJson(cookieHeader, path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookieHeader },
    redirect: "manual",
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, body, text };
}

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Khong tao duoc tai khoan ${email}: ${error?.message}`);
  }
  createdUserIds.push(data.user.id);
  return data.user.id;
}

async function insertDay(employeeId, date, checkOut) {
  const { data: checkInAt } = await admin.rpc("tf_local_instant", {
    p_date: date,
    p_time: "08:00:00",
  });
  const { data: checkOutAt } = await admin.rpc("tf_local_instant", {
    p_date: date,
    p_time: checkOut,
  });
  const { data: worked } = await admin.rpc("tf_worked_minutes", {
    p_check_in: checkInAt,
    p_check_out: checkOutAt,
    p_break_minutes: 0,
  });
  const { error } = await admin.from("attendance_records").insert({
    id: `att-e2ep-${suffix}-${employeeId.slice(-5)}-${date}`,
    company_id: COMPANY_ID,
    employee_id: employeeId,
    work_date: date,
    shift_id: SHIFT_ID,
    check_in_at: checkInAt,
    check_out_at: checkOutAt,
    worked_minutes: worked,
    late_minutes: 0,
    early_leave_minutes: 0,
    status: "on_time",
    location: "Test",
    needs_supplement: false,
    note: null,
  });
  if (error) throw new Error(`Khong tao duoc ban ghi ${date}: ${error.message}`);
}

async function insertLeave(employeeId, date) {
  const { error } = await admin.from("attendance_records").insert({
    id: `att-e2ep-${suffix}-${employeeId.slice(-5)}-${date}`,
    company_id: COMPANY_ID,
    employee_id: employeeId,
    work_date: date,
    shift_id: SHIFT_ID,
    check_in_at: null,
    check_out_at: null,
    worked_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    status: "leave_unpaid",
    location: "Test",
    needs_supplement: false,
    note: null,
  });
  if (error) throw new Error(`Khong tao duoc ngay nghi ${date}: ${error.message}`);
}

/**
 * `[mo phong ghi]` — chuoi lenh ma `closePayroll()` chay. Script ngoai khong
 * goi duoc Server Action, nen day la cach duy nhat de vong doi di tiep.
 * Nguon cua cac con so van la `GET /api/payroll/summary` that (tham so `rows`).
 */
async function closePayrollDirectly(rows, closedByUserId) {
  const { data: settings } = await admin
    .from("company_settings")
    .select("work_mode, standard_hours_per_day, standard_days_per_month")
    .eq("company_id", COMPANY_ID)
    .single();

  const { data: run, error: runError } = await admin
    .from("payroll_runs")
    .insert({
      company_id: COMPANY_ID,
      period_start: PERIOD_START,
      work_mode: settings.work_mode,
      standard_hours_per_day: settings.standard_hours_per_day,
      standard_days_per_month: settings.standard_days_per_month,
      closed_by: closedByUserId,
    })
    .select("id")
    .single();
  if (runError) throw new Error(`Khong chot duoc luong: ${runError.message}`);

  const { data: lines, error: lineError } = await admin
    .from("payroll_lines")
    .insert(
      rows.map((row) => ({
        company_id: COMPANY_ID,
        run_id: run.id,
        employee_id: row.employeeId,
        employee_code: row.employeeCode,
        employee_name: row.employeeName,
        department_name: row.departmentName,
        pay_unit: row.payUnit,
        pay_amount: row.payAmount,
        credited_days: row.creditedDays,
        regular_minutes: row.regularMinutes,
        hour_delta_minutes: row.hourDeltaMinutes,
        converted_overtime_hours: row.convertedOvertimeHours,
        late_count: row.lateCount,
        worked_days: row.workedDays,
        total_minutes: row.totalMinutes,
        leave_days: row.leaveDays,
        overtime_minutes: row.overtimeMinutes,
        overtime_night_minutes: row.overtimeNightMinutes,
        base_pay: row.basePay,
        overtime_pay: row.overtimePay,
        hour_adjustment: row.hourAdjustment,
        allowance_total: row.allowanceTotal,
        deduction_total: row.deductionTotal,
        net_pay: row.netPay,
      })),
    )
    .select("id, employee_id");
  if (lineError) throw new Error(`Khong ghi duoc cac dong: ${lineError.message}`);

  const lineIdByEmployee = new Map(lines.map((line) => [line.employee_id, line.id]));
  const items = rows.flatMap((row) =>
    [
      ...row.allowanceItems.map((item) => ({ ...item, kind: "allowance" })),
      ...row.deductionItems.map((item) => ({ ...item, kind: "deduction" })),
    ].map((item) => ({
      company_id: COMPANY_ID,
      line_id: lineIdByEmployee.get(row.employeeId),
      adjustment_id: item.adjustmentId,
      kind: item.kind,
      name: item.name,
      amount: item.amount,
      multiplier: item.multiplier,
    })),
  );
  if (items.length > 0) {
    const { error } = await admin.from("payroll_line_items").insert(items);
    if (error) throw new Error(`Khong ghi duoc cac khoan: ${error.message}`);
  }

  return run.id;
}

async function main() {
  step("1. Dung doanh nghiep + 3 nhan vien + mot thang cham cong");

  const adminUserId = await createUser(ADMIN_EMAIL);

  const { error: companyError } = await admin.from("companies").insert({
    id: COMPANY_ID,
    name: `Doanh nghiep e2e luong ${suffix}`,
    code: `EP${suffix.slice(0, 6).toUpperCase()}`,
    industry: "services",
    size: "1-10",
    phone: "0900000000",
    address: "Test",
    accent: "indigo",
  });
  if (companyError) throw new Error(`Khong tao duoc doanh nghiep: ${companyError.message}`);

  await admin.from("departments").insert({
    id: DEPARTMENT_ID,
    company_id: COMPANY_ID,
    name: "Phong Kho",
    description: "e2e",
    manager_id: null,
    status: "active",
  });
  await admin.from("shifts").insert({
    id: SHIFT_ID,
    company_id: COMPANY_ID,
    name: "Ca e2e",
    code: "E2EP",
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
    gender: "male",
    avatar_url: null,
    department_id: DEPARTMENT_ID,
    position: "Nhan vien kho",
    contract_type: "full_time",
    start_date: "2015-01-01",
    manager_id: null,
    shift_id: SHIFT_ID,
    work_location: "Test",
    status: "active",
    invitation_sent: false,
    can_view_payslip: false,
    can_check_in_remotely: false,
  };

  await admin.from("employees").insert([
    {
      ...baseEmployee,
      id: EMP_AN,
      code: "EP001",
      full_name: "Nguyen Van An",
      email: ADMIN_EMAIL,
      system_role: "owner",
      user_id: adminUserId,
    },
    {
      ...baseEmployee,
      id: EMP_BINH,
      code: "EP002",
      full_name: "Tran Thi Binh",
      email: `binh-${suffix}@timeflow.test`,
      system_role: "employee",
      user_id: null,
    },
    {
      ...baseEmployee,
      id: EMP_CUONG,
      code: "EP003",
      full_name: "Le Van Cuong",
      email: `cuong-${suffix}@timeflow.test`,
      system_role: "employee",
      user_id: null,
    },
  ]);

  await admin.from("memberships").insert({
    user_id: adminUserId,
    company_id: COMPANY_ID,
    role: "owner",
    status: "active",
  });

  await admin.from("overtime_rules").insert({
    company_id: COMPANY_ID,
    rule_key: "weekday",
    multiplier: 1.5,
    effective_from: "2015-01-01",
  });

  for (const employeeId of [EMP_AN, EMP_BINH, EMP_CUONG]) {
    await insertDay(employeeId, DAY_FULL, "16:00:00");
    await insertDay(employeeId, DAY_LONG, "20:00:00");
    await insertDay(employeeId, DAY_SHORT, "12:00:00");
    await insertLeave(employeeId, DAY_LEAVE);
  }

  const cookie = await signInCookie(ADMIN_EMAIL);
  console.log("  OK   fixture san sang, phien quan tri that");

  step("2. [mo phong ghi] Khai muc luong cho 2 nguoi, DE 1 NGUOI chua khai");

  await admin.from("employee_pay_rates").insert([
    {
      company_id: COMPANY_ID,
      employee_id: EMP_AN,
      unit: "month",
      amount: MONTHLY_SALARY,
      effective_from: "2015-01-01",
    },
    {
      company_id: COMPANY_ID,
      employee_id: EMP_BINH,
      unit: "month",
      amount: MONTHLY_SALARY,
      effective_from: "2015-01-01",
    },
  ]);
  console.log("  OK   An va Binh da co muc luong; Cuong CHUA khai");

  step("3. [mo phong ghi] Khai che do tinh cong + hai mau so quy doi");

  await admin.from("company_settings").insert({
    company_id: COMPANY_ID,
    work_mode: "shift",
    standard_days_per_month: 20,
    standard_hours_per_day: 8,
  });
  console.log("  OK   che do `shift`, 20 ngay cong chuan, 8 gio/ngay");

  step("4. [mo phong ghi] Khai mot phu cap TOAN CONG TY TRU BINH, va mot khoan phat di muon");

  const { data: allowance } = await admin
    .from("pay_adjustments")
    .insert({
      company_id: COMPANY_ID,
      name: "Phu cap xang xe",
      kind: "allowance",
      value_type: "fixed_amount",
      value: 500_000,
    })
    .select("id")
    .single();
  await admin.from("pay_adjustment_scopes").insert([
    {
      company_id: COMPANY_ID,
      adjustment_id: allowance.id,
      mode: "include",
      scope_type: "company",
      scope_value: null,
    },
    {
      company_id: COMPANY_ID,
      adjustment_id: allowance.id,
      mode: "exclude",
      scope_type: "employee",
      scope_value: EMP_BINH,
    },
  ]);

  const { data: penalty } = await admin
    .from("pay_adjustments")
    .insert({
      company_id: COMPANY_ID,
      name: "Phat di muon",
      kind: "deduction",
      value_type: "fixed_amount",
      value: 100_000,
      basis: "per_late",
    })
    .select("id")
    .single();
  await admin.from("pay_adjustment_scopes").insert({
    company_id: COMPANY_ID,
    adjustment_id: penalty.id,
    mode: "include",
    scope_type: "company",
    scope_value: null,
  });
  console.log("  OK   mot phu cap (toan cong ty tru Binh) va mot khoan phat di muon");

  step("5. Doc /api/payroll/summary qua HTTP that — hai dong ra tien, mot dong `null`");

  const live = await getJson(cookie, `/api/payroll/summary?month=${MONTH}`);
  check("GET /api/payroll/summary tra 200", live.status === 200, `nhan ${live.status}`);
  check("trang thai chot luong la `open`", live.body?.payrollStatus === "open");

  const rowOf = (body, id) => body?.rows?.find((row) => row.employeeId === id);
  const an = rowOf(live.body, EMP_AN);
  const binh = rowOf(live.body, EMP_BINH);
  const cuong = rowOf(live.body, EMP_CUONG);

  check(
    `An: 3 ngay cong, thuc nhan ${EXPECTED_AN.toLocaleString("vi-VN")}`,
    an?.creditedDays === 3 && an?.netPay === EXPECTED_AN,
    JSON.stringify({ creditedDays: an?.creditedDays, netPay: an?.netPay }),
  );
  check(
    `Binh (bi LOAI TRU khoi phu cap): thuc nhan ${EXPECTED_BINH.toLocaleString("vi-VN")}`,
    binh?.netPay === EXPECTED_BINH && binh?.allowanceTotal === 0,
    JSON.stringify({ netPay: binh?.netPay, allowanceTotal: binh?.allowanceTotal }),
  );
  check(
    "Binh KHONG co dong phu cap nao (D-40: loai tru thang pham vi)",
    binh?.allowanceItems?.length === 0,
    JSON.stringify(binh?.allowanceItems),
  );
  check(
    "An CO dong phu cap xang xe",
    an?.allowanceItems?.some((item) => item.name === "Phu cap xang xe") === true,
    JSON.stringify(an?.allowanceItems),
  );
  check(
    "Cuong (CHUA khai luong): thuc nhan `null`, KHONG phai 0",
    cuong?.netPay === null && cuong?.missing?.includes("pay_rate") === true,
    JSON.stringify({ netPay: cuong?.netPay, missing: cuong?.missing }),
  );
  check(
    "khong ai di muon -> khoan phat bang 0, va do la mot SU THAT chu khong phai thieu du kien",
    an?.deductionTotal === 0 && an?.missing?.length === 0,
    JSON.stringify({ deductionTotal: an?.deductionTotal, missing: an?.missing }),
  );
  check(
    "bang DOI CHIEU DUOC: thuc nhan = luong goc + tang ca + lech gio + phu cap - khau tru",
    an?.netPay ===
      an?.basePay + an?.overtimePay + an?.hourAdjustment + an?.allowanceTotal - an?.deductionTotal,
    JSON.stringify(an),
  );

  step("6. Chot luong khi KY CONG chua chot -> bi tu choi");

  // `closePayroll()` kiem dieu kien nay o tang ung dung; o day ta khang dinh
  // TRANG THAI dan toi viec tu choi, roi doi chieu voi thong diep that ma
  // `payroll-run.test.ts` bai 1 da kiem tren database that.
  check(
    "ky cong cua thang nay CHUA chot -> `closePayroll` se tu choi",
    live.body?.periodStatus === null,
    `periodStatus = ${live.body?.periodStatus}`,
  );

  step("7. [mo phong ghi] Chot ky cong, roi chot luong");

  const beforeClose = await getJson(cookie, `/api/payroll/summary?month=${MONTH}`);
  const closable = beforeClose.body.rows.filter((row) => row.netPay !== null);
  check(
    "chi 2 trong 3 dong du du kien de chot (Cuong con thieu muc luong)",
    closable.length === 2,
    `${closable.length} dong`,
  );

  // Go Cuong ra de chot duoc — dung nhu nguoi dung that se lam sau khi doc
  // thong diep tu choi cua `closePayroll` ("Le Van Cuong (chua khai muc luong)").
  //
  // Phai lam TRUOC khi chot ky cong: tu luc ky dong lai, trigger
  // `attendance_period_guard` (0021) chan ca `DELETE` tren
  // `attendance_records` — dung nhu no phai lam.
  await admin.from("attendance_records").delete().eq("employee_id", EMP_CUONG);
  await admin.from("employees").delete().eq("id", EMP_CUONG);

  const { error: periodError } = await admin.rpc("tf_close_period", {
    p_company_id: COMPANY_ID,
    p_start_date: PERIOD_START,
    p_closed_by: adminUserId,
  });
  check("chot ky cong khong loi", !periodError, periodError?.message);

  const readyToClose = await getJson(cookie, `/api/payroll/summary?month=${MONTH}`);
  const expectedTotal = readyToClose.body.rows.reduce((sum, row) => sum + row.netPay, 0);
  const runId = await closePayrollDirectly(readyToClose.body.rows, adminUserId);

  const closed = await getJson(cookie, `/api/payroll/summary?month=${MONTH}`);
  check("trang thai chot luong doi thanh `closed`", closed.body?.payrollStatus === "closed");
  check("ban chot ghi dung nguoi chot", closed.body?.payrollClosedBy === adminUserId);
  check(
    "ban chot co DUNG so dong bang so nhan vien con lai",
    closed.body?.rows?.length === readyToClose.body.rows.length,
    `${closed.body?.rows?.length} / ${readyToClose.body.rows.length}`,
  );
  check(
    `TONG bang tong cac dong (${expectedTotal.toLocaleString("vi-VN")})`,
    closed.body.rows.reduce((sum, row) => sum + row.netPay, 0) === expectedTotal,
  );
  check(
    "hai nhanh doc tra CUNG bo so — chi khac `payrollStatus`",
    rowOf(closed.body, EMP_AN)?.netPay === EXPECTED_AN &&
      rowOf(closed.body, EMP_BINH)?.netPay === EXPECTED_BINH,
    JSON.stringify({
      an: rowOf(closed.body, EMP_AN)?.netPay,
      binh: rowOf(closed.body, EMP_BINH)?.netPay,
    }),
  );

  step("8. DOI MUC LUONG cua An (gap doi) -> con so cua ky DA CHOT khong doi");

  await admin.from("employee_pay_rates").insert({
    company_id: COMPANY_ID,
    employee_id: EMP_AN,
    unit: "month",
    amount: MONTHLY_SALARY * 2,
    effective_from: "2015-06-01",
  });

  const afterRaise = await getJson(cookie, `/api/payroll/summary?month=${MONTH}`);
  const anAfterRaise = rowOf(afterRaise.body, EMP_AN);
  check(
    `muc luong da doi nhung thuc nhan cua ky VAN la ${EXPECTED_AN.toLocaleString("vi-VN")}`,
    anAfterRaise?.netPay === EXPECTED_AN,
    `nhan ${anAfterRaise?.netPay}`,
  );
  check(
    "ban chot giu nguyen MUC LUONG DA AP, khong lay muc moi",
    anAfterRaise?.payAmount === MONTHLY_SALARY,
    `nhan ${anAfterRaise?.payAmount}`,
  );
  check(
    "neu ban chot bi tinh lai, con so se la 8.000.000 — no KHONG phai vay",
    anAfterRaise?.netPay !== EXPECTED_AN_AFTER_RAISE,
  );

  step("9. HUY CHOT LUONG -> con so DOI THEO muc moi (ket qua NGUOC voi buoc 8)");

  const { error: reopenError } = await admin
    .from("payroll_runs")
    .delete()
    .eq("id", runId);
  check("huy chot khong loi", !reopenError, reopenError?.message);

  const afterReopen = await getJson(cookie, `/api/payroll/summary?month=${MONTH}`);
  const anAfterReopen = rowOf(afterReopen.body, EMP_AN);
  check("trang thai quay ve `open`", afterReopen.body?.payrollStatus === "open");
  check(
    `thuc nhan DOI THEO muc moi: ${EXPECTED_AN_AFTER_RAISE.toLocaleString("vi-VN")}`,
    anAfterReopen?.netPay === EXPECTED_AN_AFTER_RAISE,
    `nhan ${anAfterReopen?.netPay}`,
  );
  check(
    "hai buoc 8 va 9 cho HAI KET QUA NGUOC NHAU tren cung mot du lieu — ban chot that su tu chua",
    anAfterRaise?.netPay === EXPECTED_AN && anAfterReopen?.netPay === EXPECTED_AN_AFTER_RAISE,
  );

  step("10. Don sach fixture");

  // Mo lai ky de xoa duoc ban ghi cham cong — thao tac DON DEP cua kich ban,
  // khong phai mot duong di cua ung dung (D-32b: khong co duong mo lai).
  await admin.from("periods").update({ status: "open" }).eq("company_id", COMPANY_ID);
  await admin.from("payroll_runs").delete().eq("company_id", COMPANY_ID);
  await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
  await admin.from("periods").delete().eq("company_id", COMPANY_ID);
  await admin.from("pay_adjustments").delete().eq("company_id", COMPANY_ID);
  await admin.from("audit_log").delete().eq("company_id", COMPANY_ID);
  await admin.from("memberships").delete().eq("company_id", COMPANY_ID);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log(
    "  OK   da don (tru `employee_pay_rates` + `employees`/`shifts`/`departments`/`companies`: trigger append-only 0022 chan xoa muc luong nen chuoi cascade dung lai — doanh nghiep test mang id ngau nhien nen khong dung lai)",
  );

  console.log(
    failures === 0
      ? "\ne2e-payroll: TAT CA KHANG DINH DEU XANH"
      : `\ne2e-payroll: ${failures} khang dinh THAT BAI`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (cause) => {
  console.error(`\ne2e-payroll LOI: ${cause instanceof Error ? cause.message : cause}`);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  process.exit(1);
});
