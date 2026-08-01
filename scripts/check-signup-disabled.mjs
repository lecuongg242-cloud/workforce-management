/**
 * check-signup-disabled.mjs — chung minh D-13a bang endpoint that.
 *
 * D-13a noi ro: phai tat dang ky o CAU HINH Supabase Auth, khong phai chi giau
 * nut tren giao dien. `supabase/config.toml` cung khong phai bang chung — file do
 * chi dieu khien `supabase start` (stack local), ma du an nay khong dung. Cach duy
 * nhat biet su that la POST thang vao GoTrue.
 *
 * Script nay:
 *   1. POST /auth/v1/signup voi mot email ngau nhien, bang publishable key
 *      (dung khoa ma trinh duyet cam — mo phong dung ke tan cong lam duoc gi).
 *   2. Neu bi tu choi  -> dang ky da tat. Thoat 0.
 *   3. Neu duoc chap nhan -> dang ky VAN BAT. Xoa ngay tai khoan vua tao bang
 *      secret key de khong de rac lai, roi thoat 1.
 *
 * Buoc 3 quan trong: mot cong kiem tra ma tu no lam ban du lieu thi khong ai dam
 * chay lai. Probe phai tu don dau vet cua chinh no.
 *
 * Chay: npm run check:signup
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishable) {
  console.error(
    "Thieu NEXT_PUBLIC_SUPABASE_URL hoac NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  );
  process.exit(1);
}

// Ten cuc bo KHONG duoc chua chuoi "signup": GoTrue lap lai dia chi trong thong
// bao loi, nen mot cai ten nhu "signup-probe-..." se lam moi phep do chuoi tren
// thong bao do tu bao xanh. Da dinh mot lan roi — xem lich su file nay.
// Domain phai vuot qua duoc bo loc email cua Supabase. `.test` va `example.com`
// deu bi tra email_address_invalid — khi do probe bi chan TRUOC khi cham toi
// cong dang ky, nen no khong noi duoc gi. Doi domain qua TF_PROBE_DOMAIN neu
// nha cung cap doi bo loc.
const probeDomain = process.env.TF_PROBE_DOMAIN || "timeflow-probe.app";
const probeEmail = `tf-probe-${randomBytes(6).toString("hex")}@${probeDomain}`;
const probePassword = randomBytes(12).toString("base64url");

const res = await fetch(`${url}/auth/v1/signup`, {
  method: "POST",
  headers: {
    apikey: publishable,
    Authorization: `Bearer ${publishable}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: probeEmail, password: probePassword }),
});

const raw = await res.text();
let parsed = null;
try {
  parsed = JSON.parse(raw);
} catch {
  // giu raw
}

const errorCode = parsed?.error_code ?? parsed?.code ?? null;
const message = parsed?.msg ?? parsed?.message ?? null;

if (!res.ok) {
  // Chi MOT dieu kien duoc coi la bang chung: dung ma loi GoTrue dung cho viec
  // nay. Khong do chuoi trong thong bao — thong bao chua ca dia chi email gui
  // len, nen bat ky phep do chuoi nao cung co the tu khop voi chinh input.
  // Moi truong hop khac deu la KHONG KET LUAN DUOC va fail, khong bao xanh.
  if (errorCode === "signup_disabled") {
    console.log(`OK: dang ky cong khai DA TAT (HTTP ${res.status}, error_code=signup_disabled).`);
    process.exit(0);
  }

  // GoTrue chi di toi buoc gui email xac nhan SAU KHI cong dang ky da cho qua.
  // Nen mot loi rate-limit gui mail la bang chung dang ky VAN BAT — khong phai
  // "khong ket luan duoc". Khong co tai khoan nao duoc tao nen khong phai don.
  if (errorCode === "over_email_send_rate_limit") {
    console.error(
      `THAT BAI: dang ky cong khai VAN BAT.\n` +
        `  Endpoint tra HTTP ${res.status} error_code=over_email_send_rate_limit, tuc la GoTrue\n` +
        "  da cho don dang ky di qua va dang thu gui email xac nhan. Neu dang ky da tat,\n" +
        "  no se tra signup_disabled truoc do va khong bao gio cham toi buoc gui mail.\n" +
        "  Tat o Dashboard: Authentication -> Sign In / Providers -> Email ->\n" +
        '  bo chon "Allow new users to sign up".',
    );
    process.exit(1);
  }

  console.error(
    `KHONG KET LUAN DUOC: endpoint tra HTTP ${res.status}, nhung error_code khong phai "signup_disabled".\n` +
      `  error_code: ${errorCode ?? "(khong co)"}\n` +
      `  msg: ${message ?? raw.slice(0, 200)}\n` +
      "\n" +
      "Nghia la probe bi chan vi mot ly do khac (dia chi khong hop le, rate limit,\n" +
      "captcha...), nen no KHONG noi duoc gi ve viec dang ky da tat hay chua.\n" +
      "Cong nay fail-closed: khong co bang chung thi khong bao xanh.",
  );
  process.exit(1);
}

// HTTP 2xx => dang ky con bat, va vua tao ra mot tai khoan that.
console.error(
  `THAT BAI: dang ky cong khai VAN BAT. POST /auth/v1/signup tra HTTP ${res.status}.\n` +
    `  Bat ky ai cam publishable key cung tao duoc tenant moi.\n` +
    "  Tat o Dashboard: Authentication -> Sign In / Providers -> Email ->\n" +
    '  bo chon "Allow new users to sign up".',
);

// Tu don dau vet cua chinh probe.
const createdId = parsed?.user?.id ?? parsed?.id ?? null;
if (createdId && secret) {
  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.deleteUser(createdId);
  console.error(
    error
      ? `  CANH BAO: khong xoa duoc tai khoan probe ${probeEmail} (${error.message}) — xoa tay.`
      : `  (da xoa tai khoan probe ${probeEmail})`,
  );
} else if (createdId) {
  console.error(
    `  CANH BAO: thieu SUPABASE_SECRET_KEY nen khong xoa duoc tai khoan probe ${probeEmail} — xoa tay.`,
  );
}

process.exit(1);
