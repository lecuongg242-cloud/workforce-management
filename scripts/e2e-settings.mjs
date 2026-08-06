/**
 * e2e-settings.mjs — duong di cua MOT DOANH NGHIEP TRANG, qua HTTP that
 * (Phase 4, plan 04-06 Task 2).
 *
 * Cau hoi no tra loi: mot doanh nghiep vua duoc tao co dung mot dong cau hinh,
 * KHONG ngay le nao, KHONG he so nao — va moi man hinh van dung duoc chu khong
 * vo vi thieu du lieu? Roi khi doanh nghiep khai quy tac, so lieu cong co doi
 * theo dung quy tac do khong?
 *
 * BA DIEU NO CHUNG MINH, VA MOT DIEU NO KHONG:
 *   1. Trang thai khoi tao dung D-26: 1 dong `company_settings`, 0 ngay le,
 *      4 loai he so deu `null` — doc qua HTTP that voi cookie phien that.
 *   2. `/admin/settings` render duoc 200 voi doanh nghiep trang (khong vo vi
 *      bang rong).
 *   3. Khai quy tac roi doc lai `/api/attendance/classification`: gio quy doi
 *      chuyen tu "chua khai he so" (null) sang mot con so, va con so do dung
 *      cong thuc cong don cua D-28a.
 *   4. KHONG chung minh duong GHI qua HTTP: moi thao tac ghi cua Phase 4 la
 *      Server Action (D-12c), khong goi duoc tu mot script ngoai. Cac duong
 *      ghi da duoc phu bang test tich hop chay tren database that
 *      (`holidays-mutations`, `overtime-rules`, `settings-effect`).
 *
 * Chay:
 *   npm run dev -- -p 3007
 *   TF_BASE_URL=http://localhost:3007 npm run test:e2e-settings
 *
 * Fixture do chinh script tao va don sach o cuoi, TRU `overtime_rules` —
 * trigger append-only (migration 0016) chan xoa, nen doanh nghiep test mang id
 * ngau nhien de moi lan chay dung mot doanh nghiep moi.
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
const COMPANY_ID = `cty-e2e-${suffix}`;
const DEPARTMENT_ID = `dept-e2e-${suffix}`;
const SHIFT_ID = `sft-e2e-${suffix}`;
const EMPLOYEE_ID = `emp-e2e-${suffix}`;
const EMAIL = `e2e-settings-${suffix}@timeflow.test`;
const PASSWORD = `Tf!${randomUUID()}`;
/** Thang lam viec co dinh trong qua khu — khong dung chung voi fixture khac. */
const MONTH = "2017-07";
const WORK_DATE = "2017-07-06"; // Thu Nam

let failures = 0;
let userId = "";

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

async function main() {
  step("1. Tao doanh nghiep TRANG (tai khoan + company + ca + nhan vien)");

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userError || !created.user) {
    throw new Error(`Khong tao duoc tai khoan test: ${userError?.message}`);
  }
  userId = created.user.id;

  const inserts = [
    admin.from("companies").insert({
      id: COMPANY_ID,
      name: `Doanh nghiep e2e ${suffix}`,
      code: `E2E${suffix.slice(0, 5).toUpperCase()}`,
      industry: "services",
      size: "1-10",
      phone: "0900000000",
      address: "Test",
      accent: "indigo",
    }),
  ];
  for (const result of await Promise.all(inserts)) {
    if (result.error) throw new Error(`Khong tao duoc doanh nghiep: ${result.error.message}`);
  }

  // Dong cau hinh duoc tao GIONG HET `createCompanyAction()`: chi truyen
  // company_id, moi gia tri lay tu DEFAULT cua migration 0015.
  await admin.from("company_settings").insert({ company_id: COMPANY_ID });
  await admin.from("departments").insert({
    id: DEPARTMENT_ID,
    company_id: COMPANY_ID,
    name: "Phong ban mac dinh",
    description: "e2e",
    manager_id: null,
    status: "active",
  });
  await admin.from("shifts").insert({
    id: SHIFT_ID,
    company_id: COMPANY_ID,
    name: "Ca e2e",
    code: "E2E",
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
    code: "E2E001",
    full_name: "Nhan vien e2e",
    email: EMAIL,
    phone: "0900000000",
    date_of_birth: "1990-01-01",
    gender: "male",
    avatar_url: null,
    department_id: DEPARTMENT_ID,
    position: "Test",
    contract_type: "full_time",
    start_date: "2016-01-01",
    manager_id: null,
    shift_id: SHIFT_ID,
    work_location: "Test",
    status: "active",
    system_role: "owner",
    invitation_sent: false,
    can_view_payslip: true,
    can_check_in_remotely: false,
    user_id: userId,
  });
  await admin.from("memberships").insert({
    user_id: userId,
    company_id: COMPANY_ID,
    role: "owner",
    status: "active",
  });

  step("2. Trang thai khoi tao dung D-26 (doc thang tu database)");

  const [{ count: settingsCount }, { count: holidayCount }, { count: ruleCount }] =
    await Promise.all([
      admin
        .from("company_settings")
        .select("company_id", { count: "exact", head: true })
        .eq("company_id", COMPANY_ID),
      admin
        .from("holidays")
        .select("id", { count: "exact", head: true })
        .eq("company_id", COMPANY_ID),
      admin
        .from("overtime_rules")
        .select("id", { count: "exact", head: true })
        .eq("company_id", COMPANY_ID),
    ]);

  check("dung MOT dong company_settings", settingsCount === 1, `nhan ${settingsCount}`);
  check("KHONG ngay le nao duoc cai san", holidayCount === 0, `nhan ${holidayCount}`);
  check("KHONG he so nao duoc cai san", ruleCount === 0, `nhan ${ruleCount}`);

  step("3. Dang nhap that va doc qua HTTP");

  const anon = createClient(url, pub, { auth: { persistSession: false } });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (signInError || !signIn.session) {
    throw new Error(`Khong dang nhap duoc: ${signInError?.message}`);
  }

  // Cookie phien theo dung khuon `@supabase/ssr` ma middleware cua app doc.
  const ref = new URL(url).hostname.split(".")[0];
  const cookieValue = `base64-${Buffer.from(
    JSON.stringify({
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      expires_at: signIn.session.expires_at,
      expires_in: signIn.session.expires_in,
      token_type: "bearer",
      user: signIn.session.user,
    }),
  ).toString("base64")}`;
  const cookieHeader = `sb-${ref}-auth-token=${cookieValue}; tf_active_company=${COMPANY_ID}`;

  async function getJson(path) {
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

  const settings = await getJson("/api/settings");
  check("GET /api/settings tra 200", settings.status === 200, `nhan ${settings.status}`);
  check(
    "cau hinh mac dinh dung (5 lan ban kinh / 120 phut / 22:00-06:00)",
    settings.body?.suspiciousDistanceMultiplier === 5 &&
      settings.body?.shiftWindowGraceMinutes === 120 &&
      settings.body?.nightStartTime === "22:00" &&
      settings.body?.nightEndTime === "06:00",
    JSON.stringify(settings.body),
  );

  const holidays = await getJson("/api/holidays?year=2017");
  check("GET /api/holidays tra 200", holidays.status === 200, `nhan ${holidays.status}`);
  check(
    "nam chua khai -> mang RONG, khong loi",
    Array.isArray(holidays.body) && holidays.body.length === 0,
    JSON.stringify(holidays.body),
  );

  const rules = await getJson("/api/overtime-rules");
  check("GET /api/overtime-rules tra 200", rules.status === 200, `nhan ${rules.status}`);
  check(
    "du BON loai ngay, tat ca deu CHUA KHAI (null, khong phai 1.0)",
    Array.isArray(rules.body) &&
      rules.body.length === 4 &&
      rules.body.every((group) => group.currentMultiplier === null),
    JSON.stringify(rules.body),
  );

  const settingsPage = await fetch(`${BASE}/admin/settings`, {
    headers: { cookie: cookieHeader },
    redirect: "manual",
  });
  const settingsHtml = await settingsPage.text();
  check(
    "/admin/settings render 200 voi doanh nghiep trang",
    settingsPage.status === 200,
    `nhan ${settingsPage.status}`,
  );
  check(
    "trang cai dat co du bon tab",
    ["Chung", "Ca làm việc", "Ngày lễ", "Tăng ca"].every((tab) =>
      settingsHtml.includes(tab),
    ),
    "thieu it nhat mot tab",
  );

  step("4. Mot ngay cong co tang ca, khi CHUA khai he so");

  const { data: checkInAt } = await admin.rpc("tf_local_instant", {
    p_date: WORK_DATE,
    p_time: "08:00:00",
  });
  const { data: checkOutAt } = await admin.rpc("tf_local_instant", {
    p_date: WORK_DATE,
    p_time: "18:00:00",
  });
  const { data: worked } = await admin.rpc("tf_worked_minutes", {
    p_check_in: checkInAt,
    p_check_out: checkOutAt,
    p_break_minutes: 0,
  });
  await admin.from("attendance_records").insert({
    id: `att-e2e-${suffix}`,
    company_id: COMPANY_ID,
    employee_id: EMPLOYEE_ID,
    work_date: WORK_DATE,
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

  const before = await getJson(
    `/api/attendance/classification?employeeId=${EMPLOYEE_ID}&month=${MONTH}`,
  );
  const beforeDay = Array.isArray(before.body)
    ? before.body.find((item) => item.date === WORK_DATE)
    : null;
  check("GET /api/attendance/classification tra 200", before.status === 200);
  check("ngay do la ngay thuong, co 120 phut tang ca", beforeDay?.overtimeMinutes === 120,
    JSON.stringify(beforeDay));
  check(
    "CHUA khai he so -> gio quy doi la null, KHONG phai 0",
    beforeDay?.convertedOvertimeHours === null &&
      beforeDay?.missingMultiplierKeys?.includes("weekday"),
    JSON.stringify(beforeDay),
  );

  step("5. Khai quy tac roi doc lai — so lieu doi theo dung quy tac");

  await admin.from("overtime_rules").insert({
    company_id: COMPANY_ID,
    rule_key: "weekday",
    multiplier: 1.5,
    effective_from: "2017-01-01",
  });

  const after = await getJson(
    `/api/attendance/classification?employeeId=${EMPLOYEE_ID}&month=${MONTH}`,
  );
  const afterDay = Array.isArray(after.body)
    ? after.body.find((item) => item.date === WORK_DATE)
    : null;
  check(
    "sau khi khai he so 1.5: 120 phut -> 3 gio quy doi",
    afterDay?.convertedOvertimeHours === 3,
    JSON.stringify(afterDay),
  );

  step("6. Khai phien ban MOI hieu luc tu SAU ngay do — so lieu cu KHONG doi (tieu chi 4)");

  await admin.from("overtime_rules").insert({
    company_id: COMPANY_ID,
    rule_key: "weekday",
    multiplier: 3,
    effective_from: "2017-08-01",
  });

  const afterNewVersion = await getJson(
    `/api/attendance/classification?employeeId=${EMPLOYEE_ID}&month=${MONTH}`,
  );
  const unchangedDay = Array.isArray(afterNewVersion.body)
    ? afterNewVersion.body.find((item) => item.date === WORK_DATE)
    : null;
  check(
    "gio quy doi cua ngay cu VAN la 3 gio (khong nhay theo he so moi)",
    unchangedDay?.convertedOvertimeHours === 3,
    JSON.stringify(unchangedDay),
  );

  step("7. Don sach fixture");

  await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
  await admin.from("holidays").delete().eq("company_id", COMPANY_ID);
  await admin.from("audit_log").delete().eq("company_id", COMPANY_ID);
  await admin.from("memberships").delete().eq("company_id", COMPANY_ID);
  await admin.from("employees").delete().eq("company_id", COMPANY_ID);
  await admin.from("shifts").delete().eq("company_id", COMPANY_ID);
  await admin.from("departments").delete().eq("company_id", COMPANY_ID);
  await admin.auth.admin.deleteUser(userId);
  console.log(
    "  OK   da don (tru `overtime_rules` + `companies`: trigger append-only chan xoa — doanh nghiep test mang id ngau nhien nen khong dung lai)",
  );

  console.log(
    failures === 0
      ? "\ne2e-settings: TAT CA KHANG DINH DEU XANH"
      : `\ne2e-settings: ${failures} khang dinh THAT BAI`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (cause) => {
  console.error(`\ne2e-settings LOI: ${cause instanceof Error ? cause.message : cause}`);
  if (userId) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  process.exit(1);
});
