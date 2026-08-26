/**
 * Bo dau cham trong phan local cua email Vinh Yen Food:
 *   hien.nt@vinhyenfood.com  ->  hiennt@vinhyenfood.com
 *
 * Doi o CA HAI noi, vi mot noi thoi la hong dang nhap hoac hong hien thi:
 *   1. auth.users.email  — cai nguoi ta go khi dang nhap
 *   2. employees.email   — cai hien tren giao dien quan tri
 *
 * Chay lai duoc: da doi roi thi buoc do bao "da xong", khong lam gi them.
 * Mac dinh CHI DOC. Them --apply moi ghi.
 */
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const DOMAIN = "vinhyenfood.com";
const COMPANY_ID = "cty-vinhyen";
const APPLY = process.argv.includes("--apply");

// Chi doi 10 nhan vien. Chu "yen" von khong co dau cham.
const RENAMES = [
  ["NV001", "hien.nt", "hiennt"],
  ["NV002", "anh.tt", "anhtt"],
  ["NV003", "thai.nv", "thainv"],
  ["NV004", "thu.ntm", "thuntm"],
  ["NV005", "hieu.lt", "hieult"],
  ["NV006", "yen.nt", "yennt"],
  ["NV007", "muoi.dt", "muoidt"],
  ["NV008", "vietanh.hv", "vietanhhv"],
  ["NV009", "sau.nt", "saunt"],
  ["NV010", "hung.dv", "hungdv"],
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) { console.error("Thieu NEXT_PUBLIC_SUPABASE_URL hoac SUPABASE_SECRET_KEY"); process.exit(1); }

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

// Quet toan bo auth.users mot lan, lap ban do email -> id
const byEmail = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error("Loi doc danh sach tai khoan:", error.message); process.exit(1); }
  const users = data?.users ?? [];
  for (const u of users) if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
  if (users.length < 1000) break;
}

const { data: emps, error: empErr } = await admin
  .from("employees").select("id, code, full_name, email").eq("company_id", COMPANY_ID).order("code");
if (empErr) { console.error("Loi doc bang employees:", empErr.message); process.exit(1); }

console.log(`\n${APPLY ? "GHI THAT" : "CHI DOC (them --apply de ghi)"} — ${emps.length} ho so o ${COMPANY_ID}\n`);

let doiAuth = 0, doiEmp = 0, xong = 0, thieu = 0;

for (const [code, oldLocal, newLocal] of RENAMES) {
  const oldEmail = `${oldLocal}@${DOMAIN}`;
  const newEmail = `${newLocal}@${DOMAIN}`;
  const emp = emps.find((e) => e.code === code);
  const oldId = byEmail.get(oldEmail);
  const newId = byEmail.get(newEmail);

  const canDoiAuth = Boolean(oldId) && !newId;
  const canDoiEmp = emp && emp.email !== newEmail;

  if (!oldId && newId && emp?.email === newEmail) { console.log(`  ${code}  da xong tu truoc  ${newEmail}`); xong++; continue; }
  if (!oldId && !newId) { console.log(`  ${code}  KHONG THAY tai khoan nao (ca cu lan moi)`); thieu++; continue; }

  console.log(`  ${code}  ${emp?.full_name ?? "?"}`);
  console.log(`        auth.users : ${canDoiAuth ? `${oldEmail} -> ${newEmail}` : oldId && newId ? "ca hai email cung ton tai — BO QUA, xu ly tay" : "da la email moi"}`);
  console.log(`        employees  : ${canDoiEmp ? `${emp.email} -> ${newEmail}` : "da dung"}`);

  if (!APPLY) continue;

  if (canDoiAuth) {
    const { error } = await admin.auth.admin.updateUserById(oldId, { email: newEmail, email_confirm: true });
    if (error) { console.error(`        LOI doi auth ${code}: ${error.message}`); continue; }
    doiAuth++;
  }
  if (canDoiEmp) {
    const { error } = await admin.from("employees").update({ email: newEmail }).eq("id", emp.id);
    if (error) { console.error(`        LOI doi employees ${code}: ${error.message}`); continue; }
    doiEmp++;
  }
}

console.log(`\nTong ket: auth doi ${doiAuth} | employees doi ${doiEmp} | da xong tu truoc ${xong} | khong thay ${thieu}\n`);
