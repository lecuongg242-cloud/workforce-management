/**
 * e2e-approval.mjs — VONG DOI DAY DU cua mot yeu cau, qua HTTP that
 * (Phase 5, plan 05-06 Task 2).
 *
 * Cau hoi no tra loi: mot yeu cau di tu luc nhan vien gui den luc so lieu ky
 * doi, nguoi gui duoc bao, va ky duoc chot — co chay duoc mot lan dau-cuoi
 * tren he thong that khong?
 *
 * NAM DIEU NO CHUNG MINH, VA MOT DIEU NO KHONG:
 *   1. Danh sach cho xu ly doc duoc qua HTTP bang cookie QUAN TRI that, va
 *      moi dong mang ngu canh nguoi gui (ten + phong ban).
 *   2. Xem truoc tac dong tra dung con so: mot don nghi 4 ngay lich co 2 ngay
 *      cuoi tuan -> 2 ngay cong (D-35).
 *   3. Sau khi duyet, `GET /api/attendance/summary` doi dung 2 ngay nghi phep,
 *      va lich su xu ly co dung MOT dong.
 *   4. Nhan vien doc `GET /api/notifications` bang cookie CUA CHINH HO va thay
 *      dung mot thong bao noi dung quyet dinh (APRV-05).
 *   5. Sau khi chot ky: ghi thang vao ky bi CHAN, roi ngay sau do mot yeu cau
 *      duoc duyet van di duoc, roi ghi thang LAI bi chan — ba khang dinh lien
 *      nhau la bang chung co bao ve khong ro (D-32a).
 *
 *   6. NO KHONG CHUNG MINH DUONG GHI CUA TANG UNG DUNG. Moi thao tac ghi cua
 *      du an la Server Action (D-12c), va Server Action khong goi duoc tu mot
 *      script ngoai — gioi han nay da duoc ghi tu 04-06. Cac buoc GHI o day
 *      goi THANG cac RPC/lenh ma Server Action goi, va duoc danh dau ro bang
 *      `[mo phong ghi]`. Ban than `reviewRequest()` / `closePeriod()` duoc phu
 *      boi test tich hop chay tren database that (`request-effect.test.ts`,
 *      `period-close.test.ts`, `notifications.test.ts`).
 *
 * Chay:
 *   npm run dev -- -p 3008
 *   TF_BASE_URL=http://localhost:3008 npm run test:e2e-approval
 *
 * Fixture do chinh script tao va don o cuoi, TRU `request_reviews` (trigger
 * append-only 0017 chan xoa) va do do ca `work_requests` + `companies` —
 * doanh nghiep test mang id ngau nhien de moi lan chay dung mot doanh nghiep
 * moi.
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
const COMPANY_ID = `cty-e2e5-${suffix}`;
const DEPARTMENT_ID = `dept-e2e5-${suffix}`;
const SHIFT_ID = `sft-e2e5-${suffix}`;
const ADMIN_EMPLOYEE_ID = `emp-e2e5-${suffix}-adm`;
const STAFF_EMPLOYEE_ID = `emp-e2e5-${suffix}-nv`;
const ADMIN_EMAIL = `e2e-approval-adm-${suffix}@timeflow.test`;
const STAFF_EMAIL = `e2e-approval-nv-${suffix}@timeflow.test`;
const PASSWORD = `Tf!${randomUUID()}`;

const REQUEST_LEAVE = `wr-e2e5-${suffix}-leave`;
const REQUEST_SUPPLEMENT = `wr-e2e5-${suffix}-supp`;

/**
 * Thang lam viec co dinh trong qua khu. Ca test lam Thu Hai–Thu Sau.
 * 2014-10-01 la Thu Tu; 03 Thu Sau, 04 Thu Bay, 05 Chu Nhat, 06 Thu Hai.
 */
const MONTH = "2014-10";
const WORKED_DATE = "2014-10-01";
const LEAVE_FROM = "2014-10-03"; // Thu Sau
const LEAVE_TO = "2014-10-06"; // Thu Hai — 4 ngay lich, 2 ngay cuoi tuan o giua
const SUPPLEMENT_DATE = "2014-10-08"; // Thu Tu, nam trong ky se bi chot
const BLOCKED_DATE = "2014-10-09"; // Thu Nam, dung de thu ghi thang

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
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
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
  if (error || !data.user) throw new Error(`Khong tao duoc tai khoan ${email}: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return data.user.id;
}

/**
 * `[mo phong ghi]` — chuoi lenh ma `reviewRequest()` chay. Script ngoai khong
 * goi duoc Server Action, nen day la cach duy nhat de vong doi di tiep. Ban
 * than Server Action duoc phu boi test tich hop tren database that.
 */
async function approveRequest(requestId, reviewerUserId, reviewerEmployeeId, recipientUserId) {
  const { data: review, error: reviewError } = await admin
    .from("request_reviews")
    .insert({
      company_id: COMPANY_ID,
      request_id: requestId,
      decision: "approved",
      note: null,
      reviewer_user_id: reviewerUserId,
      reviewer_employee_id: reviewerEmployeeId,
    })
    .select("id, created_at")
    .single();
  if (reviewError) throw new Error(`Khong ghi duoc lich su: ${reviewError.message}`);

  const { error: updateError } = await admin
    .from("work_requests")
    .update({
      status: "approved",
      reviewer_id: reviewerEmployeeId,
      review_note: null,
      reviewed_at: review.created_at,
    })
    .eq("id", requestId);
  if (updateError) throw new Error(`Khong cap nhat duoc yeu cau: ${updateError.message}`);

  const { data: effect, error: applyError } = await admin.rpc("tf_apply_approved_request", {
    p_request_id: requestId,
  });
  if (applyError) throw new Error(`Khong ap dung duoc tac dong: ${applyError.message}`);

  const { error: notifyError } = await admin.from("notifications").insert({
    company_id: COMPANY_ID,
    user_id: recipientUserId,
    kind: "request_reviewed",
    title: "Yêu cầu của bạn đã được duyệt",
    body: "Xin nghỉ phép đã được duyệt.",
    request_id: requestId,
  });
  if (notifyError) throw new Error(`Khong gui duoc thong bao: ${notifyError.message}`);

  return effect;
}

/** Ghi THANG mot ban ghi cham cong — duong ma trigger 0021 phai chan. */
async function insertRecordDirectly(id, date) {
  return admin.from("attendance_records").insert({
    id: `att-e2e5-${suffix}-${id}`,
    company_id: COMPANY_ID,
    employee_id: STAFF_EMPLOYEE_ID,
    work_date: date,
    shift_id: SHIFT_ID,
    check_in_at: null,
    check_out_at: null,
    worked_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    status: "leave_paid",
    location: "Test",
    needs_supplement: false,
    note: null,
  });
}

async function main() {
  step("1. Dung doanh nghiep + hai tai khoan + mot thang du lieu cham cong");

  const adminUserId = await createUser(ADMIN_EMAIL);
  const staffUserId = await createUser(STAFF_EMAIL);

  const { error: companyError } = await admin.from("companies").insert({
    id: COMPANY_ID,
    name: `Doanh nghiep e2e 05 ${suffix}`,
    code: `E5${suffix.slice(0, 6).toUpperCase()}`,
    industry: "services",
    size: "1-10",
    phone: "0900000000",
    address: "Test",
    accent: "indigo",
  });
  if (companyError) throw new Error(`Khong tao duoc doanh nghiep: ${companyError.message}`);

  await admin.from("company_settings").insert({ company_id: COMPANY_ID });
  await admin.from("departments").insert({
    id: DEPARTMENT_ID,
    company_id: COMPANY_ID,
    name: "Phong Kinh doanh",
    description: "e2e",
    manager_id: null,
    status: "active",
  });
  await admin.from("shifts").insert({
    id: SHIFT_ID,
    company_id: COMPANY_ID,
    name: "Ca e2e",
    code: "E2E5",
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
    position: "Test",
    contract_type: "full_time",
    start_date: "2013-01-01",
    manager_id: null,
    shift_id: SHIFT_ID,
    work_location: "Test",
    status: "active",
    invitation_sent: false,
    can_view_payslip: true,
    can_check_in_remotely: false,
  };

  await admin.from("employees").insert([
    {
      ...baseEmployee,
      id: ADMIN_EMPLOYEE_ID,
      code: "E2E5ADM",
      full_name: "Quan tri e2e",
      email: ADMIN_EMAIL,
      system_role: "owner",
      user_id: adminUserId,
    },
    {
      ...baseEmployee,
      id: STAFF_EMPLOYEE_ID,
      code: "E2E5NV",
      full_name: "Nhan vien e2e",
      email: STAFF_EMAIL,
      system_role: "employee",
      user_id: staffUserId,
    },
  ]);

  await admin.from("memberships").insert([
    { user_id: adminUserId, company_id: COMPANY_ID, role: "owner", status: "active" },
    { user_id: staffUserId, company_id: COMPANY_ID, role: "employee", status: "active" },
  ]);

  const { data: checkInAt } = await admin.rpc("tf_local_instant", {
    p_date: WORKED_DATE,
    p_time: "08:00:00",
  });
  const { data: checkOutAt } = await admin.rpc("tf_local_instant", {
    p_date: WORKED_DATE,
    p_time: "16:00:00",
  });
  await admin.from("attendance_records").insert({
    id: `att-e2e5-${suffix}-worked`,
    company_id: COMPANY_ID,
    employee_id: STAFF_EMPLOYEE_ID,
    work_date: WORKED_DATE,
    shift_id: SHIFT_ID,
    check_in_at: checkInAt,
    check_out_at: checkOutAt,
    worked_minutes: 480,
    late_minutes: 0,
    early_leave_minutes: 0,
    status: "on_time",
    location: "Test",
    needs_supplement: false,
    note: null,
  });

  const adminCookie = await signInCookie(ADMIN_EMAIL);
  const staffCookie = await signInCookie(STAFF_EMAIL);
  console.log("  OK   fixture san sang, hai phien dang nhap that");

  step("2. [mo phong ghi] Nhan vien gui yeu cau nghi phep 03/10 – 06/10 (co 2 ngay cuoi tuan)");

  await admin.from("work_requests").insert({
    id: REQUEST_LEAVE,
    company_id: COMPANY_ID,
    employee_id: STAFF_EMPLOYEE_ID,
    type: "leave",
    status: "pending",
    from_date: LEAVE_FROM,
    to_date: LEAVE_TO,
    from_time: null,
    to_time: null,
    reason: "[e2e 05-06] Ve que giai quyet viec gia dinh.",
  });
  console.log("  OK   yeu cau da duoc tao");

  step("3. Quan tri doc danh sach cho xu ly qua HTTP that");

  const pending = await getJson(adminCookie, "/api/requests?status=pending");
  check("GET /api/requests?status=pending tra 200", pending.status === 200, `nhan ${pending.status}`);
  const found = Array.isArray(pending.body)
    ? pending.body.find((item) => item.id === REQUEST_LEAVE)
    : null;
  check("yeu cau vua gui co mat trong danh sach", found !== null && found !== undefined);
  check(
    "moi dong mang ngu canh nguoi gui (ten nhan vien + phong ban)",
    found?.employeeName === "Nhan vien e2e" && found?.departmentName === "Phong Kinh doanh",
    JSON.stringify({ name: found?.employeeName, dept: found?.departmentName }),
  );

  step("4. Xem truoc tac dong: 4 ngay lich -> 2 ngay cong (bo 2 ngay cuoi tuan, D-35)");

  const preview = await getJson(adminCookie, `/api/requests/${REQUEST_LEAVE}/effect`);
  check("GET /api/requests/[id]/effect tra 200", preview.status === 200, `nhan ${preview.status}`);
  check(
    "xem truoc noi se tao DUNG 2 ban ghi cong",
    preview.body?.insertedCount === 2,
    JSON.stringify(preview.body),
  );

  step("5. [mo phong ghi] Duyet -> so lieu ky doi dung, lich su co dung mot dong");

  const beforeSummary = await getJson(
    adminCookie,
    `/api/attendance/summary?employeeId=${STAFF_EMPLOYEE_ID}&month=${MONTH}`,
  );
  const effect = await approveRequest(REQUEST_LEAVE, adminUserId, ADMIN_EMPLOYEE_ID, staffUserId);
  check("ham ap dung bao da tao 2 ban ghi", effect?.inserted_count === 2, JSON.stringify(effect));

  const afterSummary = await getJson(
    adminCookie,
    `/api/attendance/summary?employeeId=${STAFF_EMPLOYEE_ID}&month=${MONTH}`,
  );
  check(
    "so ngay nghi phep cua ky tang DUNG 2",
    afterSummary.body?.leaveDays === (beforeSummary.body?.leaveDays ?? 0) + 2,
    `truoc ${beforeSummary.body?.leaveDays} / sau ${afterSummary.body?.leaveDays}`,
  );

  const reviews = await getJson(adminCookie, `/api/requests/${REQUEST_LEAVE}/reviews`);
  check(
    "lich su xu ly co DUNG mot dong, quyet dinh approved",
    Array.isArray(reviews.body) && reviews.body.length === 1 && reviews.body[0].decision === "approved",
    JSON.stringify(reviews.body),
  );

  step("6. Nhan vien doc thong bao bang cookie CUA CHINH HO");

  const feed = await getJson(staffCookie, "/api/notifications");
  check("GET /api/notifications tra 200", feed.status === 200, `nhan ${feed.status}`);
  check(
    "dung MOT thong bao, chua doc, noi dung nói ve quyet dinh",
    feed.body?.items?.length === 1 &&
      feed.body?.unreadCount === 1 &&
      feed.body?.items?.[0]?.requestId === REQUEST_LEAVE &&
      feed.body?.items?.[0]?.readAt === null,
    JSON.stringify(feed.body),
  );

  const adminFeed = await getJson(adminCookie, "/api/notifications");
  check(
    "quan tri KHONG doc duoc thong bao cua nhan vien (ranh gioi la con nguoi)",
    adminFeed.body?.items?.length === 0,
    JSON.stringify(adminFeed.body),
  );

  step("7. [mo phong ghi] Chot ky thang 10/2014");

  const { data: closed, error: closeError } = await admin.rpc("tf_close_period", {
    p_company_id: COMPANY_ID,
    p_start_date: `${MONTH}-01`,
    p_closed_by: adminUserId,
  });
  check("chot ky khong loi", !closeError, closeError?.message);
  check("trang thai ky la closed", closed?.status === "closed", JSON.stringify(closed));
  check("closed_by ghi dung nguoi chot", closed?.closed_by === adminUserId);

  const periods = await getJson(adminCookie, "/api/periods");
  const periodRow = Array.isArray(periods.body)
    ? periods.body.find((item) => item.month === MONTH)
    : null;
  check(
    "GET /api/periods hien ky do la da chot",
    periodRow?.status === "closed",
    JSON.stringify(periodRow),
  );

  step("8. Ghi THANG vao ky da chot -> bi chan");

  const blocked = await insertRecordDirectly("blocked", BLOCKED_DATE);
  check("insert thang bi tu choi", blocked.error !== null, "khong co loi nao");
  check(
    "thong diep noi ro ky da chot",
    blocked.error?.message?.includes("đã chốt") === true,
    blocked.error?.message,
  );

  step("9. Yeu cau duoc duyet VAN di duoc vao ky da chot");

  await admin.from("work_requests").insert({
    id: REQUEST_SUPPLEMENT,
    company_id: COMPANY_ID,
    employee_id: STAFF_EMPLOYEE_ID,
    type: "attendance_supplement",
    status: "pending",
    from_date: SUPPLEMENT_DATE,
    to_date: SUPPLEMENT_DATE,
    from_time: "08:00",
    to_time: "16:00",
    reason: "[e2e 05-06] Quen bam gio, xin bo sung.",
  });

  const supplementEffect = await approveRequest(
    REQUEST_SUPPLEMENT,
    adminUserId,
    ADMIN_EMPLOYEE_ID,
    staffUserId,
  );
  check(
    "duyet bo sung cong tao DUOC ban ghi trong ky da chot",
    supplementEffect?.inserted_count === 1,
    JSON.stringify(supplementEffect),
  );

  step("10. Ngay sau do, ghi thang LAI bi chan — co bao ve khong ro (D-32a)");

  const blockedAgain = await insertRecordDirectly("blocked-again", BLOCKED_DATE);
  check("insert thang van bi tu choi", blockedAgain.error !== null, "khong co loi nao");

  step("11. Don sach fixture");

  // Mo lai ky de xoa duoc ban ghi cham cong — thao tac DON DEP cua kich ban,
  // khong phai mot duong di cua ung dung (D-32b: khong co duong mo lai).
  await admin.from("periods").update({ status: "open" }).eq("company_id", COMPANY_ID);
  await admin.from("notifications").delete().eq("company_id", COMPANY_ID);
  await admin.from("attendance_records").delete().eq("company_id", COMPANY_ID);
  await admin.from("periods").delete().eq("company_id", COMPANY_ID);
  await admin.from("audit_log").delete().eq("company_id", COMPANY_ID);
  await admin.from("memberships").delete().eq("company_id", COMPANY_ID);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  console.log(
    "  OK   da don (tru `request_reviews` + `work_requests` + `employees`/`shifts`/`departments`/`companies`: trigger append-only 0017 chan xoa lich su xu ly nen chuoi cascade dung lai — doanh nghiep test mang id ngau nhien nen khong dung lai)",
  );

  console.log(
    failures === 0
      ? "\ne2e-approval: TAT CA KHANG DINH DEU XANH"
      : `\ne2e-approval: ${failures} khang dinh THAT BAI`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (cause) => {
  console.error(`\ne2e-approval LOI: ${cause instanceof Error ? cause.message : cause}`);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  process.exit(1);
});
