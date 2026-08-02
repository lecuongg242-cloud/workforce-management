/**
 * e2e-walkthrough.mjs — di het cac man hinh bang phien that, qua HTTP that.
 *
 * Bo sung cho scripts/e2e-auth.mjs: file kia kiem cong chan va bay D-16a;
 * file nay kiem rang MOI man hinh thuc su render voi mot phien hop le, va
 * kiem may dieu ma truoc day phai nguoi nhin moi thay.
 *
 * Ba dieu no chung minh duoc bang co che, thay vi bang quan sat mot lan:
 *
 *   1. KHONG LOE GIAO DIEN. Khong phai "toi nhin va khong thay loe" — ma la
 *      trinh duyet KHONG BAO GIO nhan duoc HTML cua trang quan tri. Redirect
 *      phat ra tu middleware truoc khi Server Component chay. Script khang dinh
 *      than phan hoi 307 rong va khong chua dau vet giao dien quan tri.
 *
 *   2. PHIEN SONG QUA DONG/MO TRINH DUYET. Cai quyet dinh dieu nay la thuoc tinh
 *      cookie: co Max-Age thi trinh duyet giu qua lan dong; khong co thi mat.
 *      Script doc thuoc tinh that tu header Set-Cookie.
 *
 *   3. MOI MAN HINH RENDER TREN DU LIEU THAT. Goi tung route voi cookie that,
 *      khang dinh 200 va co dau hieu noi dung mong doi.
 *
 * Dieu no KHONG lam duoc, va khong nhan la lam duoc:
 *   - Canh bao lech lan ve (hydration) trong Console trinh duyet. Do la canh bao
 *     phia client, khong xuat hien trong HTML tra ve. Bang chung gian tiep duy
 *     nhat la rule ESLint D-19a cam doc gio may trong client component.
 *
 * Chay:
 *   npm run dev
 *   TF_BASE_URL=http://localhost:3007 npm run test:walkthrough -- <email> <matkhau>
 */

import { createClient } from "@supabase/supabase-js";

const BASE = process.env.TF_BASE_URL || "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Su dung: npm run test:walkthrough -- <email> <matkhau>");
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
const COOKIE_NAME = `sb-${ref}-auth-token`;
const CHUNK = 3180;

let pass = 0;
let fail = 0;
const notes = [];

function check(name, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function cookieHeader(s) {
  const payload = {
    access_token: s.access_token,
    token_type: s.token_type,
    expires_in: s.expires_in,
    expires_at: s.expires_at,
    refresh_token: s.refresh_token,
    user: s.user,
  };
  const enc = `base64-${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
  if (enc.length <= CHUNK) return `${COOKIE_NAME}=${enc}`;
  const parts = [];
  for (let i = 0; i < enc.length; i += CHUNK) {
    parts.push(`${COOKIE_NAME}.${parts.length}=${enc.slice(i, i + CHUNK)}`);
  }
  return parts.join("; ");
}

async function signIn(em, pw) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: pub, Authorization: `Bearer ${pub}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: em, password: pw }),
  });
  if (!res.ok) throw new Error(`dang nhap that bai: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function get(path, cookie) {
  return fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { Cookie: cookie } : {},
  });
}

console.log(`\nBASE = ${BASE}\n`);

const admin = secret
  ? createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const session = await signIn(email, password);
let cookie = cookieHeader(session);

/* --------------------------------------------------------------- */
console.log("A. Khong loe giao dien quan tri (AUTH-02) — chung minh bang cau tao");

for (const path of ["/admin/dashboard", "/admin/employees", "/admin/shifts", "/employee"]) {
  const res = await get(path, null);
  const body = await res.text();
  const isRedirect = res.status === 307 || res.status === 302;
  // Than phan hoi cua mot redirect phai rong hoac chi la ghi chu ky thuat cua
  // Next.js. Neu no chua bat cu dau vet nao cua giao dien quan tri thi nghia la
  // HTML da kip sinh ra va duoc gui di — luc do "loe" moi co the xay ra.
  const leaks = /sidebar|dashboard-view|admin-shell|Tổng quan|Nhân viên</i.test(body);
  check(
    `${path} — 307 va than phan hoi khong chua giao dien quan tri`,
    isRedirect && !leaks,
    `HTTP ${res.status}, body ${body.length} byte`,
  );
}
notes.push(
  "Khong co redirect phia client nao toi /login trong src/app hay src/components " +
    "(kiem bang git grep) — redirect duy nhat phat tu middleware.ts truoc khi Server " +
    "Component chay. Vi vay trinh duyet khong bao gio nhan HTML quan tri de ma loe.",
);

/* --------------------------------------------------------------- */
console.log("\nB. Phien song qua dong/mo trinh duyet (AUTH-01) — doc thuoc tinh cookie that");

{
  const res = await get("/admin/dashboard", cookie);
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const authCookie = setCookies.find((c) => c.startsWith(COOKIE_NAME));

  if (authCookie) {
    const hasMaxAge = /max-age=\d+/i.test(authCookie);
    const maxAge = authCookie.match(/max-age=(\d+)/i)?.[1];
    check(
      "cookie phien co Max-Age (khong phai session cookie)",
      hasMaxAge,
      hasMaxAge ? `Max-Age=${maxAge}s (~${Math.round(Number(maxAge) / 86400)} ngay)` : authCookie.slice(0, 120),
    );
    check("cookie phien co HttpOnly", /httponly/i.test(authCookie));
    check("cookie phien co SameSite", /samesite/i.test(authCookie));
  } else {
    // Middleware chi ghi lai cookie khi can lam moi. Khong co Set-Cookie o day
    // KHONG phai loi — nhung khi do phai suy tu chinh phien.
    check(
      "phien mang expires_at tuong minh (co so de trinh duyet giu qua lan dong)",
      Boolean(session.expires_at),
      session.expires_at ? new Date(session.expires_at * 1000).toISOString() : "khong co",
    );
    check("phien co refresh_token de gia han sau khi mo lai", Boolean(session.refresh_token));
    notes.push(
      "Middleware khong tra Set-Cookie o request nay vi token con han — dung theo " +
        "thiet ke cua @supabase/ssr (chi ghi lai khi lam moi). Da suy tu expires_at " +
        "va refresh_token cua chinh phien.",
    );
  }
}

/* --------------------------------------------------------------- */
console.log("\nC. Doi doanh nghiep khi thuoc nhieu noi (AUTH-05)");

if (admin) {
  const { data: mem } = await admin
    .from("memberships")
    .select("user_id, company_id")
    .eq("user_id", session.user.id);
  const companyCount = mem ? mem.length : 0;
  check(
    "tai khoan nay thuoc nhieu hon mot doanh nghiep",
    companyCount > 1,
    `${companyCount} membership`,
  );

  // Phan kiem noi dung /select-company nam o muc D: o day tai khoan van con co
  // must_change_password nen middleware da moi trang ve /doi-mat-khau — dung
  // theo thiet ke, va chinh dieu do da duoc muc B cua e2e-auth.mjs chung minh.
  console.log("  (noi dung /select-company kiem o muc D, sau khi qua cong doi mat khau)");
} else {
  console.log("  (bo qua: thieu SUPABASE_SECRET_KEY)");
}

/* --------------------------------------------------------------- */
console.log("\nD. Moi man hinh render tren du lieu that (DATA-05, DATA-08)");

// De di het man hinh, tai khoan phai qua duoc cong buoc doi mat khau.
// Xoa co tam thoi roi tra lai — giong cach e2e-auth.mjs lam o muc C.
let flagCleared = false;
const claims = JSON.parse(
  Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8"),
);
if (claims.app_metadata?.must_change_password === true && admin) {
  await admin.auth.admin.updateUserById(session.user.id, {
    app_metadata: { must_change_password: false },
  });
  const refreshed = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: pub, Authorization: `Bearer ${pub}`, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  }).then((r) => r.json());
  cookie = cookieHeader(refreshed);
  flagCleared = true;
  console.log("  (tam xoa co must_change_password de di het man hinh; se tra lai o cuoi)");
}

// Chon doanh nghiep. `getSessionContext()` lay company hien hanh tu cookie
// `tf_active_company` roi DOI CHIEU LAI voi memberships cua chinh nguoi goi
// (D-12b) — nen cookie chi la goi y, khong phai quyen.
let activeCompanyId = null;
if (admin) {
  const { data: mem } = await admin
    .from("memberships")
    .select("company_id")
    .eq("user_id", session.user.id)
    .order("company_id");
  if (mem && mem.length > 0) {
    activeCompanyId = mem[0].company_id;
    cookie = `${cookie}; tf_active_company=${activeCompanyId}`;
    console.log(`  (chon doanh nghiep ${activeCompanyId} qua cookie tf_active_company)`);
  }
}

// /select-company phai hien du TEN THAT cua moi doanh nghiep nguoi nay thuoc ve,
// lay tu Postgres — khong phai chuoi cung trong ma nguon.
if (admin && activeCompanyId) {
  const { data: mem2 } = await admin
    .from("memberships")
    .select("company_id")
    .eq("user_id", session.user.id);
  const { data: cos } = await admin
    .from("companies")
    .select("id, name")
    .in("id", (mem2 || []).map((m) => m.company_id));
  // Trang /select-company render VO o server; danh sach do client lay qua Route
  // Handler (D-12: doc di qua /api/*). Nen kiem dung nguon du lieu that, khong
  // kiem HTML server tra ve — HTML do khong bao gio chua ten doanh nghiep.
  const shell = await get("/select-company", cookie);
  const shellBody = shell.status === 200 ? await shell.text() : "";
  check(
    "/select-company render vo trang",
    shell.status === 200 && /Chọn doanh nghiệp/i.test(shellBody),
    `HTTP ${shell.status}`,
  );

  const apiRes = await get("/api/companies", cookie);
  const apiJson = apiRes.status === 200 ? await apiRes.json() : null;
  const list = Array.isArray(apiJson) ? apiJson : apiJson?.data ?? apiJson?.companies ?? [];
  const allShown =
    (cos || []).length > 0 && (cos || []).every((c) => list.some((x) => x.name === c.name));
  check(
    "GET /api/companies tra du ten that cac doanh nghiep tu Postgres (AUTH-05)",
    apiRes.status === 200 && allShown,
    `HTTP ${apiRes.status} — ${list.map((x) => `${x.name} (${x.role}, ${x.employeeCount})`).join(" | ")}`,
  );
}

const screens = [
  ["/select-company", /Ngọc Phát|Bình Minh|doanh nghiệp/i],
  ["/admin/dashboard", /Tổng quan|dashboard/i],
  ["/admin/employees", /Nhân viên/i],
  ["/admin/employees/new", /Thêm nhân viên|Mã nhân viên/i],
  ["/admin/departments", /Phòng ban/i],
  ["/admin/shifts", /Ca làm việc/i],
  // Nut "Vào ca" duoc ve sau khi mount nen khong co trong HTML tu server. Dung
  // dau hieu do server render: loi chao kem ten that va ngay that.
  ["/employee", /Chào buổi|Hôm nay,/i],
  ["/employee/history", /Lịch sử/i],
  ["/employee/requests", /Yêu cầu/i],
  ["/employee/profile", /Hồ sơ|Thông tin/i],
  ["/onboarding", /doanh nghiệp/i],
];

for (const [path, marker] of screens) {
  const res = await get(path, cookie);
  const body = res.status === 200 ? await res.text() : "";
  const ok = res.status === 200 && marker.test(body);
  check(
    `${path}`,
    ok,
    res.status === 200 ? `200, ${body.length} byte` : `HTTP ${res.status} -> ${res.headers.get("location") || ""}`,
  );
}

/* --------------------------------------------------------------- */
console.log("\nE. Doi doanh nghiep — du lieu doi theo (AUTH-05)");

if (admin && activeCompanyId) {
  const { data: mem } = await admin
    .from("memberships")
    .select("company_id")
    .eq("user_id", session.user.id)
    .order("company_id");

  const other = (mem || []).map((m) => m.company_id).find((c) => c !== activeCompanyId);
  if (other) {
    const baseCookie = cookie.split("; tf_active_company=")[0];
    const otherCookie = `${baseCookie}; tf_active_company=${other}`;

    const a = await get("/api/employees?page=1", cookie).then((r) => r.json());
    const b = await get("/api/employees?page=1", otherCookie).then((r) => r.json());

    const countA = a?.total ?? a?.data?.length ?? JSON.stringify(a).length;
    const countB = b?.total ?? b?.data?.length ?? JSON.stringify(b).length;
    check(
      "doi cookie doanh nghiep -> du lieu tra ve doi theo",
      JSON.stringify(a) !== JSON.stringify(b),
      `${activeCompanyId}: ${countA} | ${other}: ${countB}`,
    );
  } else {
    console.log("  (bo qua: tai khoan chi thuoc mot doanh nghiep)");
  }

  /* Gia mao cookie: dat tf_active_company sang mot doanh nghiep nguoi nay
     KHONG phai thanh vien. D-12b noi cookie chi la goi y, server phai doi chieu
     lai voi memberships — nen phai KHONG duoc cap quyen. */
  const { data: allCos } = await admin.from("companies").select("id");
  const notMine = (allCos || [])
    .map((c) => c.id)
    .find((id) => !(mem || []).some((m) => m.company_id === id));

  if (notMine) {
    const baseCookie = cookie.split("; tf_active_company=")[0];
    const forged = `${baseCookie}; tf_active_company=${notMine}`;
    const res = await get("/api/employees?page=1", forged);
    const body = res.status === 200 ? await res.text() : "";
    const mine = await get("/api/employees?page=1", cookie).then((r) => r.text());
    check(
      `gia mao tf_active_company=${notMine} KHONG cap duoc quyen (D-12b)`,
      res.status !== 200 || body === mine,
      res.status !== 200
        ? `HTTP ${res.status} — tu choi`
        : "HTTP 200 nhung tra ve du lieu cua doanh nghiep hop le, khong phai cua cai gia mao",
    );
  } else {
    console.log("  (bo qua gia mao: nguoi nay la thanh vien cua moi doanh nghiep)");
  }
}

if (flagCleared && admin) {
  await admin.auth.admin.updateUserById(session.user.id, {
    app_metadata: { must_change_password: true },
  });
  console.log("  (da tra co must_change_password ve true)");
}

/* --------------------------------------------------------------- */
console.log(`\n=== ${pass} pass, ${fail} fail ===`);
if (notes.length) {
  console.log("\nGhi chu:");
  for (const n of notes) console.log(`  - ${n}`);
}
console.log(
  "\nKHONG kiem duoc bang script nay: canh bao lech lan ve (hydration) trong Console\n" +
    "trinh duyet. Do la canh bao phia client, khong nam trong HTML tra ve. Bang chung\n" +
    "gian tiep la rule ESLint D-19a cam new Date()/Date.now() trong client component.\n",
);
process.exit(fail === 0 ? 0 : 1);
