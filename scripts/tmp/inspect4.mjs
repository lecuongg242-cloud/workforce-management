import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false } });
const C="cty-01";
const KEEP_CODES=["NV001","NV002","NV003","NV004","NV022"];
const { data: emps } = await admin.from("employees").select("id, code").eq("company_id", C).order("code");
const keep = new Set(emps.filter(e=>KEEP_CODES.includes(e.code)).map(e=>e.id));
const { data: wr } = await admin.from("work_requests").select("id, employee_id, reviewer_id").eq("company_id", C);
const { data: rv } = await admin.from("request_reviews").select("request_id").eq("company_id", C);
const reviewed = new Set(rv.map(r=>r.request_id));

let blocked=0, deletable=0;
const blockedEmp = new Map();
for (const r of wr) {
  if (keep.has(r.employee_id)) continue;
  if (reviewed.has(r.id)) { blocked++; blockedEmp.set(r.employee_id,(blockedEmp.get(r.employee_id)??0)+1); }
  else deletable++;
}
console.log(`work_requests cua nguoi SE BI XOA: ${blocked} co review (CHAN), ${deletable} khong co review (xoa duoc)`);
console.log(`So nhan vien bi chan: ${blockedEmp.size} / 23`);
const codeById = new Map(emps.map(e=>[e.id,e.code]));
for (const [id,n] of blockedEmp) console.log(`  ${codeById.get(id)}: ${n} yeu cau da duyet`);

const revBy = wr.filter(r=>r.reviewer_id && !keep.has(r.reviewer_id)).length;
console.log(`\nwork_requests co reviewer_id tro toi nguoi bi xoa: ${revBy} (go bang UPDATE, khong bi chan)`);
