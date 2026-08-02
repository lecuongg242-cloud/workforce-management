/**
 * e2e-photo.mjs — kiem chung co lap anh cham cong xuyen doanh nghiep bang
 * HTTP that, tren dev server dang chay.
 *
 * Day chinh xac la ranh gioi ma tieu chi 4 cua ROADMAP mo ta bang ngon ngu
 * cua ke tan cong: "nguoi o doanh nghiep khac cam dung lien ket van khong
 * xem duoc". Test tich hop goi ham trong tien trinh (route.test.ts, 03-01)
 * la bang chung tot nhung KHONG PHAI bang chung nay — script nay dung mot
 * phien dang nhap that cam dung URL va thu that qua mang.
 *
 * Sao khuon `e2e-auth.mjs`: tu dung cookie theo dung quy uoc @supabase/ssr
 * (`sb-<ref>-auth-token`, gia tri `base64-` + JSON phien, tach manh khi qua
 * 3180 ky tu), ham `check()` dem pass/fail, in bang ket qua roi thoat khac 0
 * khi co FAIL.
 *
 * GIOI HAN QUAN TRONG — chi doc, khong ghi: script nay CHI kiem duoc duong
 * DOC (broker Route Handler `GET /api/attendance-photos/[id]` va route sieu
 * du lieu `GET /api/attendance-photos`). Server Action `checkIn()`/`checkOut()`
 * KHONG PHAI mot tep route va duoc Next.js goi qua mot giao thuc noi bo voi
 * dinh danh phu thuoc ban dung — khong co cach thuc te nao de mot script
 * shell goi thang ham cham cong qua HTTP. Duong GHI da duoc chung minh bang
 * test tich hop goi module truc tiep (plan 03-01/03-04) — do la MOT LOAI
 * bang chung khac, va KHONG DUOC tong ket thanh "da kiem qua HTTP that
 * dau-cuoi" o bat ky tai lieu nao doc ket qua script nay.
 *
 * Buoc chuan bi dung quyen admin (SUPABASE_SECRET_KEY), KHONG di qua duong
 * HTTP dang duoc kiem — day la thiet lap du lieu test, khong phai hanh vi
 * duoc xac nhan:
 *   1. Dung mot fixture JPEG that vao dung `storage_path` da co san trong
 *      `attendance_photos` (seed chi tao dong DATABASE, khong tao object
 *      that trong Storage — thieu buoc nay broker route se 502).
 *   2. Tim mot tai khoan "nhan vien thuong" (role=employee) cua doanh nghiep
 *      A va tam cap mat khau moi cho no, roi dang nhap that qua Auth API —
 *      can cho khang dinh 403 (script chi nhan 4 doi so tren dong lenh, hai
 *      quan tri, nen tai khoan thu ba nay phai tu suy ra).
 *
 * Chay:
 *   npm run dev                                   # o mot terminal khac
 *   npm run seed:auth && npm run reset:passwords   # lay mat khau tam
 *   npm run test:e2e-photo -- <email-A> <mk-A> <email-B> <mk-B>
 *
 * <email-A>/<mk-A> va <email-B>/<mk-B> phai la tai khoan quan tri (owner/
 * admin) cua HAI doanh nghiep khac nhau.
 *
 * Nhung dieu script nay KHONG kiem duoc, van phai nguoi nhin:
 *   - Quan tri thuc su mo Dialog va nhin thay dung anh trong trinh duyet
 *   - Duong GHI (checkIn/checkOut) qua camera/GPS that (xem gioi han o tren)
 */

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.TF_BASE_URL || "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

// Ten bucket copy lai tu `src/lib/storage/attendance-photos.ts` — script Node
// thuan nay khong import duoc file .ts (khong co ts-node/tsx trong deps, cung
// ly do da ghi trong `scripts/storage-bucket.mjs`).
const ATTENDANCE_PHOTO_BUCKET = "attendance-photos";

if (!url || !pub) {
  console.error("Thieu NEXT_PUBLIC_SUPABASE_URL hoac NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const [emailA, passwordA, emailB, passwordB] = process.argv.slice(2);
if (!emailA || !passwordA || !emailB || !passwordB) {
  console.error(
    "Su dung: npm run test:e2e-photo -- <email-quan-tri-A> <mat-khau-A> <email-quan-tri-B> <mat-khau-B>\n" +
      "Hai tai khoan phai la quan tri (owner/admin) cua HAI doanh nghiep khac nhau.\n" +
      "Lay mat khau tam bang `npm run reset:passwords`.",
  );
  process.exit(1);
}

if (!secret) {
  console.error(
    "Thieu SUPABASE_SECRET_KEY — script can quyen admin de dung fixture JPEG that\n" +
      "vao Storage va tam cap mat khau cho mot tai khoan nhan vien thuong (xem\n" +
      "khoi comment dau file). Ca hai deu la buoc thiet lap, khong di qua duong\n" +
      "HTTP dang duoc kiem.",
  );
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ref = new URL(url).hostname.split(".")[0];
const COOKIE_NAME = `sb-${ref}-auth-token`;
const CHUNK = 3180;

let pass = 0;
let fail = 0;

function check(name, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function cookieHeader(session) {
  const payload = {
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  };
  const encoded = `base64-${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
  if (encoded.length <= CHUNK) return `${COOKIE_NAME}=${encoded}`;
  const parts = [];
  for (let i = 0; i < encoded.length; i += CHUNK) {
    parts.push(`${COOKIE_NAME}.${parts.length}=${encoded.slice(i, i + CHUNK)}`);
  }
  return parts.join("; ");
}

async function tokenReq(body) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=${body.grant_type}`, {
    method: "POST",
    headers: {
      apikey: pub,
      Authorization: `Bearer ${pub}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${body.grant_type} that bai: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function signIn(email, password) {
  const session = await tokenReq({ grant_type: "password", email, password });
  return { session, cookie: cookieHeader(session) };
}

async function get(path, cookie) {
  return fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { Cookie: cookie } : {},
  });
}

// 1x1 pixel JPEG hop le (magic bytes FF D8 FF), dung lam fixture upload — day
// KHONG phai anh cham cong that, chi la du lieu byte hop le de broker route
// tai xuong duoc va tra ve content-type anh.
const JPEG_FIXTURE = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);

/* ------------------------------------------------------------------ */

console.log(`\nBASE   = ${BASE}`);
console.log(`cookie = ${COOKIE_NAME}\n`);

try {
  await get("/login", null);
} catch {
  console.error(
    `Khong ket noi duoc toi ${BASE}. Chay \`npm run dev\` truoc, va dat TF_BASE_URL\n` +
      "neu Next.js nhay sang cong khac (doc dong `Local:` trong output).",
  );
  process.exit(1);
}

console.log("Buoc chuan bi (dung admin key, KHONG di qua HTTP dang duoc kiem):");

// (1) Xac dinh company_id + user_id cua doanh nghiep A tu chinh email dang
// nhap duoc truyen vao — day la dong employees ma seed-auth.mjs dung de tao
// tai khoan. Lay ca user_id cua B vi buoc (5) can no de tam go co
// must_change_password (xem giai thich duoi).
const { data: adminARow, error: adminARowErr } = await admin
  .from("employees")
  .select("company_id, user_id")
  .eq("email", emailA)
  .limit(1)
  .maybeSingle();
if (adminARowErr || !adminARow) {
  console.error(
    `Khong tim thay employees.company_id cho "${emailA}": ${adminARowErr?.message ?? "khong co dong nao"}`,
  );
  process.exit(1);
}
const companyAId = adminARow.company_id;
console.log(`  company_id doanh nghiep A = ${companyAId}`);

const { data: adminBRow, error: adminBRowErr } = await admin
  .from("employees")
  .select("user_id")
  .eq("email", emailB)
  .limit(1)
  .maybeSingle();
if (adminBRowErr || !adminBRow) {
  console.error(
    `Khong tim thay employees.user_id cho "${emailB}": ${adminBRowErr?.message ?? "khong co dong nao"}`,
  );
  process.exit(1);
}

// (2) Tim mot anh cham cong co san cua doanh nghiep A (du lieu seed) — dung
// de biet attendance_record_id va storage_path can dung fixture vao.
const { data: photoRow, error: photoRowErr } = await admin
  .from("attendance_photos")
  .select("attendance_record_id, storage_path")
  .eq("company_id", companyAId)
  .eq("kind", "check_in")
  .limit(1)
  .maybeSingle();
if (photoRowErr || !photoRow) {
  console.error(
    `Khong tim thay du lieu attendance_photos mau cho doanh nghiep A (${companyAId}) -- ` +
      "chay `npm run db:seed` truoc khi chay script nay.",
  );
  process.exit(1);
}
console.log(`  attendance_record_id mau = ${photoRow.attendance_record_id}`);

// (3) Dung fixture JPEG that vao dung storage_path da seed -- db:seed chi tao
// dong o tang DATABASE (attendance_photos), KHONG tao object that trong
// Storage; broker route se 502 (khong tai duoc) neu thieu buoc nay.
const { error: uploadErr } = await admin.storage
  .from(ATTENDANCE_PHOTO_BUCKET)
  .upload(photoRow.storage_path, JPEG_FIXTURE, { contentType: "image/jpeg", upsert: true });
if (uploadErr) {
  console.error(`Khong dung duoc fixture JPEG vao Storage (${photoRow.storage_path}): ${uploadErr.message}`);
  process.exit(1);
}
console.log(`  da dung fixture JPEG vao Storage: ${photoRow.storage_path}`);

// (4) Tim mot tai khoan "nhan vien thuong" (role = employee, khong phai
// owner/admin) cua doanh nghiep A va tam cap mat khau moi -- can cho khang
// dinh 403 o duoi.
const { data: memberRow, error: memberRowErr } = await admin
  .from("memberships")
  .select("user_id")
  .eq("company_id", companyAId)
  .eq("role", "employee")
  .eq("status", "active")
  .limit(1)
  .maybeSingle();
if (memberRowErr || !memberRow) {
  console.error(`Khong tim thay mot membership role=employee cho doanh nghiep A (${companyAId}).`);
  process.exit(1);
}
const { data: employeeAccountRow, error: employeeAccountErr } = await admin
  .from("employees")
  .select("email")
  .eq("company_id", companyAId)
  .eq("user_id", memberRow.user_id)
  .maybeSingle();
if (employeeAccountErr || !employeeAccountRow) {
  console.error(`Khong tim thay email cua nhan vien thuong (user_id=${memberRow.user_id}).`);
  process.exit(1);
}
// must_change_password=false ngay tu dau (khong phai true) -- tai khoan nay
// chi dung de kiem 403, khong phai co buoc doi mat khau (bay D-16a da co
// e2e-auth.mjs kiem rieng).
const employeeTempPassword = randomBytes(9).toString("base64url");
const { error: passwordResetErr } = await admin.auth.admin.updateUserById(memberRow.user_id, {
  password: employeeTempPassword,
  app_metadata: { must_change_password: false },
});
if (passwordResetErr) {
  console.error(`Khong tam cap mat khau duoc cho nhan vien thuong: ${passwordResetErr.message}`);
  process.exit(1);
}
console.log(`  tai khoan nhan vien thuong = ${employeeAccountRow.email}`);

// (5) `npm run reset:passwords` (buoc chuan bi cua nguoi van hanh, xem
// SUMMARY) dat co must_change_password=true tren MOI tai khoan -- middleware
// (src/middleware.ts) chan TOAN BO duong dan (ke ca /api/*) khi co nay bat,
// kho phai chi trang giao dien. Script nay khong kiem cong doi mat khau (da
// co e2e-auth.mjs), nen tam go co cho A/B TRUOC khi dang nhap, va tra co lai
// dung gia tri cu SAU KHI kiem xong (khong de lai dau vet), cung khuon voi
// Phan C cua e2e-auth.mjs.
async function readMustChangePassword(userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    console.error(`Khong doc duoc user "${userId}": ${error?.message ?? "khong tim thay"}`);
    process.exit(1);
  }
  return data.user.app_metadata?.must_change_password === true;
}

async function setMustChangePassword(userId, value) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { must_change_password: value },
  });
  if (error) {
    console.error(`Khong doi duoc must_change_password cho "${userId}": ${error.message}`);
    process.exit(1);
  }
}

const originalMustChangeA = await readMustChangePassword(adminARow.user_id);
const originalMustChangeB = await readMustChangePassword(adminBRow.user_id);
if (originalMustChangeA) await setMustChangePassword(adminARow.user_id, false);
if (originalMustChangeB) await setMustChangePassword(adminBRow.user_id, false);
console.log("  da tam go co must_change_password cho A/B (se tra lai sau khi kiem xong).\n");

/* ------------------------------------------------------------------ */
console.log("Dang nhap ba tai khoan bang HTTP that (dung khuon @supabase/ssr):");

const a = await signIn(emailA, passwordA);
const b = await signIn(emailB, passwordB);
const employeeA = await signIn(employeeAccountRow.email, employeeTempPassword);
console.log("  da dang nhap ca ba tai khoan.\n");

/* ------------------------------------------------------------------ */
console.log("Kiem co lap anh xuyen doanh nghiep qua HTTP that (ATT-05, tieu chi 4 ROADMAP):");

// Doc sieu du lieu bang cookie A -> lay dung id (uuid sinh luc chay) cua anh
// tu chinh response nay -- KHONG nhung cung dinh danh do vao script.
const metaRes = await get(
  `/api/attendance-photos?attendanceRecordId=${encodeURIComponent(photoRow.attendance_record_id)}`,
  a.cookie,
);
check("A doc duoc sieu du lieu anh (metadata 200)", metaRes.status === 200, `HTTP ${metaRes.status}`);

let photoId = null;
if (metaRes.status === 200) {
  const items = await metaRes.json();
  const checkInItem = Array.isArray(items) ? items.find((item) => item.kind === "check_in") : null;
  photoId = checkInItem?.id ?? null;
  check(
    "metadata tra ve dung anh check_in cua ban ghi mau",
    Boolean(photoId),
    photoId ? `id=${photoId}` : "khong tim thay",
  );
}

async function restoreMustChangePasswordFlags() {
  if (originalMustChangeA) await setMustChangePassword(adminARow.user_id, true);
  if (originalMustChangeB) await setMustChangePassword(adminBRow.user_id, true);
}

if (!photoId) {
  console.error("\nKhong lay duoc id anh tu metadata -- dung lai, khong the kiem broker route.");
  await restoreMustChangePasswordFlags();
  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  process.exit(1);
}

const photoUrl = `/api/attendance-photos/${photoId}`;

const okRes = await get(photoUrl, a.cookie);
check("A xem duoc anh cua chinh doanh nghiep minh (200)", okRes.status === 200, `HTTP ${okRes.status}`);
check(
  "phan hoi 200 co content-type la anh",
  (okRes.headers.get("content-type") || "").startsWith("image/"),
  okRes.headers.get("content-type") || "(khong co)",
);
check(
  "phan hoi 200 mang cache-control chua no-store",
  (okRes.headers.get("cache-control") || "").includes("no-store"),
  okRes.headers.get("cache-control") || "(khong co)",
);

const crossRes = await get(photoUrl, b.cookie);
check("cookie doanh nghiep B nhan 404", crossRes.status === 404, `HTTP ${crossRes.status}`);

const employeeRes = await get(photoUrl, employeeA.cookie);
check("nhan vien thuong (cung doanh nghiep A) nhan 403", employeeRes.status === 403, `HTTP ${employeeRes.status}`);

const noCookieRes = await get(photoUrl, null);
check("khong cookie nhan 401", noCookieRes.status === 401, `HTTP ${noCookieRes.status}`);

await restoreMustChangePasswordFlags();
console.log("\nDa tra lai co must_change_password cua A/B ve gia tri cu (khong de lai dau vet).");

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
console.log(
  "Nhac lai gioi han: script nay CHI kiem duoc duong DOC qua HTTP that. Duong GHI\n" +
    "(checkIn/checkOut) di qua Server Action, khong phai mot tep route, va KHONG\n" +
    "kiem duoc bang cach nay -- xem khoi comment dau file.\n",
);
process.exit(fail === 0 ? 0 : 1);
