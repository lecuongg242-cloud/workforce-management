#!/usr/bin/env node
/**
 * e2e vong doi mot phien ho tro qua HTTP THAT (Phase 6, Task 9).
 *
 * Khac `scripts/e2e-support-rls.mjs` — script do chung minh ranh gioi o TANG
 * DATABASE (PostgREST + RLS truc tiep). Script nay di qua chinh ung dung
 * Next.js dang chay: cookie phien that, `middleware.ts` that, Route Handler
 * that, `getSessionContext()` that. Do la lop duy nhat con lai chua ai kiem,
 * va cung la lop de vo nhat vi no phu thuoc vao ca hai lop duoi.
 *
 * Chay:
 *   npm run dev -- -p 3010
 *   TF_BASE_URL=http://localhost:3010 npm run test:e2e-support
 *
 * Fixture do chinh script tao va don o cuoi. Dong `support_sessions` KHONG
 * xoa duoc bang duong nguoi dung (khong co policy delete — D-55) nhung khoa
 * service thi xoa duoc, va script don bang khoa service.
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
const ADMIN_EMAIL = `e2e-support-${suffix}@timeflow.test`;
const PASSWORD = `Tf!${randomUUID()}`;

/** Hai doanh nghiep seed — phien mo vao mot noi, phai khong thay noi kia. */
const COMPANY_A = "cty-01";
const COMPANY_B = "cty-02";

let failures = 0;
let platformAdminId = "";
const createdSessionIds = [];

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
async function signInCookie(email, activeCompany) {
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
  const base = `sb-${ref}-auth-token=${value}`;
  return activeCompany ? `${base}; tf_active_company=${activeCompany}` : base;
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

async function main() {
  step("0. Dung hien truong: mot platform admin dung-mot-lan");
  {
    const { data, error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Khong tao duoc tai khoan: ${error?.message}`);
    }
    platformAdminId = data.user.id;
    const { error: paError } = await admin
      .from("platform_admins")
      .insert({ user_id: platformAdminId });
    if (paError) throw new Error(`platform_admins: ${paError.message}`);
    console.log(`  (tai khoan ${ADMIN_EMAIL})`);
  }

  // Lam nong cac route truoc khi khang dinh bat cu dieu gi. `next dev` bien
  // dich route theo yeu cau, va mot request roi dung luc do se rot vao
  // `/_not-found` va tra 404 — mot con so khong lien quan gi den nghiep vu.
  // Ket qua cua vong nay bi BO QUA hoan toan.
  step("0b. Lam nong route (bo qua ket qua)");
  for (const path of [
    "/api/platform/companies",
    "/api/platform/sessions",
    "/api/employees?page=1&pageSize=1",
  ]) {
    await fetch(`${BASE}${path}`, { redirect: "manual" }).catch(() => {});
  }
  console.log("  (xong)");

  step("1. SADM-01 — danh sach toan he thong");
  const cookieNoCompany = await signInCookie(ADMIN_EMAIL, null);
  {
    const res = await getJson(cookieNoCompany, "/api/platform/companies");
    check(
      "GET /api/platform/companies tra 200",
      res.status === 200,
      `status ${res.status}`,
    );
    const ids = Array.isArray(res.body) ? res.body.map((row) => row.id) : [];
    check(
      "thay CA HAI doanh nghiep seed — day la 'nhin toan he thong'",
      ids.includes(COMPANY_A) && ids.includes(COMPANY_B),
      `ids=${ids.join(",")}`,
    );
    const ngocPhat = (res.body ?? []).find((row) => row.id === COMPANY_A);
    check(
      "moi dong mang so nhan vien that",
      (ngocPhat?.employeeCount ?? 0) > 0,
      `employeeCount=${ngocPhat?.employeeCount}`,
    );
  }

  step("2. Chua mo phien — khong doc duoc du lieu doanh nghiep nao");
  {
    // GET /api/employees tra 200 kem danh sach RONG cho NoMembershipError,
    // chu khong 403 — quyet dinh co tu truoc Phase 6 ("danh sach rong la du
    // lieu hop le", employees/route.ts:181-187). Thu can khang dinh la SO
    // DONG, khong phai ma trang thai: mot danh sach rong khong ro ri gi ca.
    const res = await getJson(cookieNoCompany, "/api/employees?page=1&pageSize=5");
    const items = res.body?.items ?? [];
    check(
      "GET /api/employees tra 0 dong khi chua co phien",
      items.length === 0,
      `status ${res.status}, items=${items.length}`,
    );
  }

  step("3. SADM-02 — mo phien vao cty-01 roi doc du lieu cua ho");
  {
    // Server Action khong goi duoc tu mot script ngoai, nen mo phien bang
    // chinh chuoi lenh ma `openSupportSession()` chay. Ban than Server Action
    // do duoc phu boi test tich hop `platform-sessions.test.ts` tren database
    // that (7/7), gom ca dong audit va cookie.
    const { data, error } = await admin
      .from("support_sessions")
      .insert({
        platform_admin_id: platformAdminId,
        company_id: COMPANY_A,
        reason: `e2e-support ${suffix}`,
        expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`support_sessions: ${error.message}`);
    createdSessionIds.push(data.id);
    console.log("  (da mo phien — [mo phong ghi] cua openSupportSession)");
  }

  const cookieA = await signInCookie(ADMIN_EMAIL, COMPANY_A);
  {
    const res = await getJson(cookieA, "/api/employees?page=1&pageSize=5");
    check(
      "GET /api/employees tra 200 trong phien",
      res.status === 200,
      `status ${res.status}`,
    );
    const items = res.body?.items ?? [];
    check(
      "doc duoc >0 nhan vien cua cty-01",
      items.length > 0,
      `items=${items.length}`,
    );
    check(
      "moi dong deu thuoc cty-01",
      items.every((row) => row.companyId === undefined || row.companyId === COMPANY_A),
      "co dong khong thuoc cty-01",
    );
  }

  step("4. Phien chi mo DUNG MOT noi — doi cookie sang cty-02 khong an thua");
  {
    const cookieB = await signInCookie(ADMIN_EMAIL, COMPANY_B);
    const res = await getJson(cookieB, "/api/employees?page=1&pageSize=5");
    const items = res.body?.items ?? [];
    // KHANG DINH QUAN TRONG NHAT CUA CA SCRIPT: phien mo vao cty-01, cookie
    // tro toi cty-02 — ket qua phai la 0 dong, khong phai du lieu cty-02.
    // Dong nay do nghia la ranh gioi co lap da vo.
    check(
      "cookie cty-02 tra 0 dong — phien chi mo DUNG MOT noi",
      items.length === 0,
      `status ${res.status}, items=${items.length}`,
    );
  }

  step("5. Tieu chi 4 — trong phien, DOC duoc nhung GHI thi khong");
  {
    // Duong ghi cua ung dung la Server Action, khong goi duoc tu day. Kiem
    // thang o tang duoi: chinh nguoi dung do, qua PostgREST, voi RLS that.
    const anon = createClient(url, pub, { auth: { persistSession: false } });
    const { data: session } = await anon.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: PASSWORD,
    });
    const { error } = await anon
      .from("holidays")
      .insert({
        company_id: COMPANY_A,
        holiday_date: "2031-01-01",
        name: "e2e khong duoc ghi",
      });
    check(
      "GHI vao cty-01 trong phien bi RLS tu choi (42501)",
      error !== null && error.code === "42501",
      error ? `${error.code}: ${error.message}` : "KHONG bi tu choi",
    );
    void session;
  }

  step("6. SADM-03 — nhat ky co dong cua phien vua mo");
  {
    const res = await getJson(cookieA, "/api/platform/sessions");
    check(
      "GET /api/platform/sessions tra 200",
      res.status === 200,
      `status ${res.status}`,
    );
    const mine = (res.body ?? []).filter((row) =>
      row.reason.includes(suffix),
    );
    check("nhat ky co dung mot dong cua lan chay nay", mine.length === 1, `co ${mine.length} dong`);
    check(
      "dong do ghi dung doanh nghiep va con dang mo",
      mine[0]?.companyId === COMPANY_A && mine[0]?.closedAt === null,
      JSON.stringify(mine[0] ?? null),
    );
  }

  step("7. Dong phien — mat quyen doc NGAY");
  {
    await admin
      .from("support_sessions")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", createdSessionIds[0]);

    const res = await getJson(cookieA, "/api/employees?page=1&pageSize=5");
    const items = res.body?.items ?? [];
    check(
      "GET /api/employees tra 0 dong lai sau khi dong phien",
      items.length === 0,
      `status ${res.status}, items=${items.length}`,
    );

    const log = await getJson(cookieA, "/api/platform/sessions");
    const mine = (log.body ?? []).find((row) => row.reason.includes(suffix));
    check(
      "nhat ky ghi lai moc dong phien",
      mine?.closedAt !== null && mine?.closedAt !== undefined,
      JSON.stringify(mine ?? null),
    );
  }

  step("8. Khu /platform dong voi nguoi khong phai platform admin");
  {
    await admin.from("platform_admins").delete().eq("user_id", platformAdminId);
    const cookie = await signInCookie(ADMIN_EMAIL, null);
    const res = await getJson(cookie, "/api/platform/companies");
    check(
      "GET /api/platform/companies tra 403 sau khi bi go quyen",
      res.status === 403,
      `status ${res.status}`,
    );
  }
}

try {
  await main();
} catch (cause) {
  failures += 1;
  console.error(`\nLoi khi chay: ${cause instanceof Error ? cause.message : cause}`);
} finally {
  for (const id of createdSessionIds) {
    await admin.from("support_sessions").delete().eq("id", id);
  }
  if (platformAdminId) {
    await admin.from("support_sessions").delete().eq("platform_admin_id", platformAdminId);
    await admin.from("audit_log").delete().eq("actor_user_id", platformAdminId);
    await admin.from("platform_admins").delete().eq("user_id", platformAdminId);
    await admin.auth.admin.deleteUser(platformAdminId);
  }
}

console.log("");
if (failures === 0) {
  console.log("e2e-support: TAT CA DEU DAT");
  process.exit(0);
}
console.error(`e2e-support: ${failures} khang dinh KHONG DAT`);
process.exit(1);
