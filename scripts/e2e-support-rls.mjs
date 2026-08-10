#!/usr/bin/env node
/**
 * Bang chung tu dong cho D-50: ranh gioi cua phien ho tro o TANG DATABASE.
 *
 * Chay bang mot phien dang nhap THAT (JWT that, auth.uid() that, RLS that) —
 * KHONG mock gi, khong dung khoa service cho phep doc nao dang duoc kiem.
 * Khoa service chi dung de dung/don hien truong (tao tai khoan, mo phien).
 *
 * Vi sao ton tai ben canh supabase/tests/20_support_sessions.sql: bo pgTAP
 * chua chay that duoc lan nao trong moi truong phat trien hien tai (thieu
 * `psql`, database dev la Supabase cloud nen bo chay tu choi nap fixture —
 * blocker treo tu 04-06). Script nay phu cung hanh vi qua duong khac, nen
 * D-50 khong phai la mot khang dinh chi ton tai tren giay.
 *
 * Tu tao mot platform admin dung-mot-lan roi don sach o khoi `finally`, dung
 * khuon scripts/e2e-approval.mjs.
 *
 * Lenh: npm run test:e2e-support-rls
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const PASSWORD = `Verify0034!${randomBytes(6).toString("hex")}`;
const EMAIL = `pa-${randomBytes(5).toString("hex")}@timeflow.test`;

const admin = createClient(url, secret, { auth: { persistSession: false } });
const anon = createClient(url, pub, { auth: { persistSession: false } });

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass, detail });

let userId = null;
let sessionId = null;
let expiredSessionId = null;

try {
  /* --- setup ------------------------------------------------------------ */
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user) throw new Error(`createUser: ${createErr?.message}`);
  userId = created.user.id;

  const { error: paErr } = await admin.from("platform_admins").insert({ user_id: userId });
  if (paErr) throw new Error(`platform_admins insert: ${paErr.message}`);

  const { data: signed, error: signErr } = await anon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (signErr || !signed.session) throw new Error(`signIn: ${signErr?.message}`);

  // Client mang JWT cua chinh platform admin — moi truy van duoi day di qua
  // RLS that voi auth.uid() that.
  const asAdminUser = createClient(url, pub, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${signed.session.access_token}` } },
  });

  /* --- 1. Chua co phien: khong doc duoc gi ------------------------------- */
  {
    const { data } = await asAdminUser.from("employees").select("id").eq("company_id", "cty-01");
    check(
      "chua mo phien: platform admin doc duoc 0 dong employees cty-01",
      (data ?? []).length === 0,
      `doc duoc ${(data ?? []).length} dong`,
    );
  }

  /* --- 2. Mo phien cho cty-01 ------------------------------------------- */
  {
    const { data, error } = await admin
      .from("support_sessions")
      .insert({
        platform_admin_id: userId,
        company_id: "cty-01",
        reason: "verify-0034",
        expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`support_sessions insert: ${error.message}`);
    sessionId = data.id;
  }

  /* --- 3. Doc duoc cty-01, KHONG doc duoc cty-02 ------------------------- */
  for (const [table, col] of [
    ["employees", "company_id"],
    ["departments", "company_id"],
    ["attendance_records", "company_id"],
    ["work_requests", "company_id"],
    ["company_settings", "company_id"],
  ]) {
    const { data: a } = await asAdminUser.from(table).select("*", { count: "exact", head: false }).eq(col, "cty-01").limit(5);
    const { data: b } = await asAdminUser.from(table).select("*").eq(col, "cty-02").limit(5);
    check(
      `${table}: trong phien cty-01 doc duoc >0 dong cty-01 va 0 dong cty-02`,
      (a ?? []).length > 0 && (b ?? []).length === 0,
      `cty-01=${(a ?? []).length} cty-02=${(b ?? []).length}`,
    );
  }

  /* --- 4. Nhanh payroll (dieu kien tf_is_company_admin, khac khuon) ------ */
  {
    const { error } = await asAdminUser.from("payroll_runs").select("id").eq("company_id", "cty-01").limit(5);
    check(
      "payroll_runs: policy *_select_scoped con hop le sau khi alter (khong loi)",
      !error,
      error ? `${error.code}: ${error.message}` : "truy van chay duoc",
    );
  }

  /* --- 5. GHI van bi tu choi -------------------------------------------- */
  {
    const { error } = await asAdminUser
      .from("holidays")
      .insert({ company_id: "cty-01", holiday_date: "2030-01-01", name: "Khong duoc ghi" });
    check(
      "holidays: GHI vao cty-01 trong phien bi tu choi (RLS)",
      error !== null && error.code === "42501",
      error ? `${error.code}: ${error.message}` : "KHONG bi tu choi — tieu chi 4 hong",
    );
  }
  {
    const { data, error } = await asAdminUser
      .from("employees")
      .update({ full_name: "Bi sua trom" })
      .eq("company_id", "cty-01")
      .select("id");
    check(
      "employees: SUA cty-01 trong phien khong cham duoc dong nao",
      !error && (data ?? []).length === 0,
      error ? `${error.code}: ${error.message}` : `sua duoc ${(data ?? []).length} dong`,
    );
  }

  /* --- 6. Dong phien -> mat quyen NGAY ----------------------------------- */
  {
    const { error } = await admin
      .from("support_sessions")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", sessionId);
    check(
      "dong phien: lenh update closed_at chay duoc",
      !error,
      error ? `${error.code}: ${error.message}` : "ok",
    );
    const { data } = await asAdminUser.from("employees").select("id").eq("company_id", "cty-01");
    check(
      "phien da dong: doc lai duoc 0 dong cty-01",
      (data ?? []).length === 0,
      `doc duoc ${(data ?? []).length} dong`,
    );
  }

  /* --- 7. Phien HET HAN cung mat quyen (khong can cron) ------------------ */
  {
    // Khong the "lui" expires_at cua phien dang mo: check constraint
    // `expires_at > opened_at` chan lai — chinh no vua chung minh minh co
    // rang o lan chay truoc. Nen tao mot phien da het han HOP LE: ca hai moc
    // deu o qua khu, va expires_at van sau opened_at.
    const past = Date.now() - 2 * 60 * 60_000;
    const { data, error } = await admin
      .from("support_sessions")
      .insert({
        platform_admin_id: userId,
        company_id: "cty-01",
        reason: "verify-0034 het han",
        opened_at: new Date(past).toISOString(),
        expires_at: new Date(past + 60 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`support_sessions insert (het han): ${error.message}`);
    expiredSessionId = data.id;

    const { data: rows } = await asAdminUser.from("employees").select("id").eq("company_id", "cty-01");
    check(
      "phien het han: doc duoc 0 dong cty-01 — het han khong can cron",
      (rows ?? []).length === 0,
      `doc duoc ${(rows ?? []).length} dong`,
    );
  }

  /* --- 8. Khach that su chua dang nhap ----------------------------------- */
  {
    // Client MOI hoan toan: `anon` o tren da signInWithPassword nen no DANG
    // mang phien cua platform admin — dung lai no thi phep kiem nay vo nghia.
    const guest = createClient(url, pub, { auth: { persistSession: false } });
    const { data } = await guest.from("employees").select("id").limit(1);
    check(
      "khach chua dang nhap doc duoc 0 dong (co lap Phase 1 con nguyen)",
      (data ?? []).length === 0,
      `doc duoc ${(data ?? []).length} dong`,
    );
  }
} finally {
  if (sessionId) await admin.from("support_sessions").delete().eq("id", sessionId);
  if (expiredSessionId) await admin.from("support_sessions").delete().eq("id", expiredSessionId);
  if (userId) {
    await admin.from("platform_admins").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}

console.log("");
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}\n        ${c.detail}`);
const failed = checks.filter((c) => !c.pass).length;
console.log(`\n${checks.length - failed}/${checks.length} pass`);
process.exit(failed === 0 ? 0 : 1);
