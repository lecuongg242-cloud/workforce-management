/**
 * e2e-auth.mjs — kiem chung xac thuc bang HTTP that, tren dev server dang chay.
 *
 * Vi sao khong nam trong `npm run test`: Vitest chay trong process, khong co
 * server that va khong co phien that. Nhung dieu quan trong nhat cua Phase 2 —
 * cong chan route, cong buoc doi mat khau, bay D-16a — chi co nghia khi di qua
 * HTTP that voi cookie that.
 *
 * Script tu dung cookie theo dung khuon @supabase/ssr (`sb-<ref>-auth-token`,
 * gia tri `base64-` + JSON phien, tach manh khi qua 3180 ky tu) roi goi thang
 * vao dev server.
 *
 * Chay:
 *   npm run dev                                  # o mot terminal khac
 *   npm run reset:passwords                      # lay mat khau tam
 *   TF_BASE_URL=http://localhost:3007 \
 *     npm run test:e2e -- <email> <matkhau>
 *
 * Nhung dieu script nay KHONG kiem duoc, van phai nguoi nhin:
 *   - Giao dien quan tri co "loe len" truoc khi chuyen trang hay khong
 *   - Canh bao lech lan ve (hydration) trong DevTools Console
 *   - Phien con song that sau khi tat han tien trinh trinh duyet
 */

import { createClient } from "@supabase/supabase-js";

const BASE = process.env.TF_BASE_URL || "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !pub) {
  console.error("Thieu NEXT_PUBLIC_SUPABASE_URL hoac NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error(
    "Su dung: npm run test:e2e -- <email> <matkhau>\n" +
      "Lay mat khau bang `npm run reset:passwords`.",
  );
  process.exit(1);
}

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

function flagOf(accessToken) {
  const claims = JSON.parse(
    Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"),
  );
  return claims.app_metadata?.must_change_password;
}

async function get(path, cookie) {
  return fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function isRedirectTo(res, fragment) {
  const loc = res.headers.get("location") || "";
  return (res.status === 307 || res.status === 302) && loc.includes(fragment);
}

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

/* A ---------------------------------------------------------------- */
console.log("A. Cong chan route khi chua dang nhap (AUTH-02)");
for (const path of ["/admin/dashboard", "/admin/employees", "/employee", "/employee/history"]) {
  const res = await get(path, null);
  check(
    `${path} -> /login`,
    isRedirectTo(res, "/login"),
    `HTTP ${res.status} -> ${res.headers.get("location") || "(khong co Location)"}`,
  );
}
check("/login mo duoc", (await get("/login", null)).status === 200);
check(
  "GET /api/companies khong cookie -> 401",
  (await get("/api/companies", null)).status === 401,
);

/* B ---------------------------------------------------------------- */
console.log("\nB. Cong buoc doi mat khau (AUTH-04, D-16)");
const s1 = await tokenReq({ grant_type: "password", email, password });
const startedFlagged = flagOf(s1.access_token) === true;
console.log(`  (must_change_password trong JWT = ${flagOf(s1.access_token)})`);

if (startedFlagged) {
  for (const path of ["/admin/dashboard", "/select-company", "/employee"]) {
    const res = await get(path, cookieHeader(s1));
    check(
      `${path} -> /doi-mat-khau`,
      isRedirectTo(res, "doi-mat-khau"),
      `HTTP ${res.status} -> ${res.headers.get("location") || "(khong co Location)"}`,
    );
  }
  check("/doi-mat-khau mo duoc", (await get("/doi-mat-khau", cookieHeader(s1))).status === 200);
} else {
  console.log("  (bo qua: tai khoan nay da doi mat khau roi)");
}

/* C ---------------------------------------------------------------- */
console.log("\nC. Bay D-16a: co chi vao JWT sau khi lam moi token");

if (!startedFlagged) {
  console.log("  (bo qua: can mot tai khoan con nguyen co must_change_password)");
} else if (!secret) {
  console.log("  (bo qua: thieu SUPABASE_SECRET_KEY nen khong mo phong duoc buoc xoa co)");
} else {
  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: clearErr } = await admin.auth.admin.updateUserById(s1.user.id, {
    app_metadata: { must_change_password: false },
  });
  check("xoa co bang Admin API", !clearErr, clearErr?.message);

  // Ban chat cua bay: token da phat van mang gia tri cu.
  check(
    "token CU van mang co CU sau khi da xoa",
    flagOf(s1.access_token) === true,
    "day chinh la cai bay",
  );
  {
    const res = await get("/admin/dashboard", cookieHeader(s1));
    check(
      "dung token cu -> VAN bi ep ve /doi-mat-khau",
      isRedirectTo(res, "doi-mat-khau"),
      `HTTP ${res.status} -> ${res.headers.get("location") || "(khong co Location)"}`,
    );
  }

  const s2 = await tokenReq({ grant_type: "refresh_token", refresh_token: s1.refresh_token });
  check("sau khi lam moi, token mang co moi", flagOf(s2.access_token) === false);
  {
    const res = await get("/admin/dashboard", cookieHeader(s2));
    const loc = res.headers.get("location") || "";
    check(
      "dung token moi -> khong con bi ep doi mat khau",
      res.status === 200 || isRedirectTo(res, "select-company"),
      `HTTP ${res.status}${loc ? ` -> ${loc}` : ""}`,
    );
  }

  // Tra lai trang thai ban dau: script kiem thu khong duoc de lai dau vet.
  await admin.auth.admin.updateUserById(s1.user.id, {
    app_metadata: { must_change_password: true },
  });
  console.log("  (da tra co must_change_password ve true)");
}

/* D ---------------------------------------------------------------- */
console.log("\nD. Phien song qua dong/mo trinh duyet (AUTH-01)");
check(
  "phien co han su dung tuong minh, khong phai session cookie",
  Boolean(s1.expires_at),
  s1.expires_at ? `het han ${new Date(s1.expires_at * 1000).toISOString()}` : "khong co expires_at",
);
check("co refresh_token de gia han sau khi dong trinh duyet", Boolean(s1.refresh_token));

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
console.log(
  "Nhac lai: khong loe giao dien, khong canh bao hydration, va phien song that\n" +
    "sau khi tat han trinh duyet — ba dieu do van phai nguoi nhin.\n",
);
process.exit(fail === 0 ? 0 : 1);
