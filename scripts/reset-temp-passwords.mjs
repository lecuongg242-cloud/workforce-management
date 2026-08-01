/**
 * reset-temp-passwords.mjs
 *
 * Dat lai mat khau tam cho cac tai khoan da duoc `seed-auth.mjs` tao, roi in ra
 * dung bang ma `seed-auth.mjs` in mot lan luc tao.
 *
 * Vi sao can script nay: `seed-auth.mjs` sinh mat khau mot lan va co tinh khong
 * ghi xuong dia (xem prohibition cua chinh no). Neu ban lam mat lan in do thi
 * khong con duong nao lay lai — ma cac buoc nghiem thu tay cua phase 2 (phien
 * song qua dong/mo trinh duyet, vong doi doi mat khau, di het 13 man hinh) deu
 * doi dang nhap that. Script nay la duong lay lai, KHONG phai duong tao moi.
 *
 * Khac biet voi viec xoa roi chay lai `seed:auth`:
 *   - GIU NGUYEN `auth.users.id`, nen `memberships`, `employees.user_id` va moi
 *     dong `audit_log.actor_user_id` da tro toi tai khoan van con nguyen.
 *   - Khong cascade xoa gi ca.
 *
 * Moi tai khoan van giu `app_metadata.must_change_password = true`, nen mat khau
 * o day chi dung duoc mot lan roi buoc doi (AUTH-04).
 *
 * Chay tu goc repo:
 *   npm run reset:passwords
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error(
    "Thieu NEXT_PUBLIC_SUPABASE_URL hoac SUPABASE_SECRET_KEY. Chay qua `npm run reset:passwords`.",
  );
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

const { data: employees, error: empError } = await admin
  .from("employees")
  .select("id, email, full_name, user_id, company_id")
  .not("user_id", "is", null)
  .order("company_id")
  .order("email");

if (empError) {
  console.error(`Loi doc employees: ${empError.message}`);
  process.exit(1);
}

if (!employees || employees.length === 0) {
  console.error(
    "Khong nhan vien nao co user_id — chua chay `npm run seed:auth` lan nao.",
  );
  process.exit(1);
}

const { data: memberships, error: memError } = await admin
  .from("memberships")
  .select("user_id, company_id, role");

if (memError) {
  console.error(`Loi doc memberships: ${memError.message}`);
  process.exit(1);
}

const { data: companies, error: coError } = await admin
  .from("companies")
  .select("id, name");

if (coError) {
  console.error(`Loi doc companies: ${coError.message}`);
  process.exit(1);
}

const companyName = new Map(companies.map((c) => [c.id, c.name]));
const roleOf = new Map(
  memberships.map((m) => [`${m.user_id}|${m.company_id}`, m.role]),
);

const rows = [];
let failures = 0;

for (const emp of employees) {
  const password = generateTempPassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(
    emp.user_id,
    { password, app_metadata: { must_change_password: true } },
  );

  if (updateError) {
    console.error(
      `Loi dat lai mat khau cho "${emp.email}": ${updateError.message}`,
    );
    failures += 1;
    continue;
  }

  rows.push({
    email: emp.email,
    company: companyName.get(emp.company_id) ?? emp.company_id,
    role: roleOf.get(`${emp.user_id}|${emp.company_id}`) ?? "(khong ro)",
    password,
  });
}

console.log("");
console.log("email | doanh nghiep | vai tro | mat khau tam");
console.log("-----------------------------------------------------------");
for (const row of rows) {
  console.log(`${row.email} | ${row.company} | ${row.role} | ${row.password}`);
}
console.log("-----------------------------------------------------------");
console.log(`Da dat lai ${rows.length} mat khau. That bai: ${failures}.`);
console.log(
  "Bang nay chi hien mot lan — luu lai ngay. Moi tai khoan van buoc doi mat khau o lan dang nhap dau.",
);

if (failures > 0) process.exit(1);
