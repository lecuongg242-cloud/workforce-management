import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const C = "cty-01";

const { data: emps } = await admin.from("employees")
  .select("id, code, full_name, position, department_id, shift_id, status, system_role, user_id")
  .eq("company_id", C).order("code");
console.log(`--- ${emps.length} NHAN VIEN ---`);
for (const e of emps) console.log(`${e.code} | ${e.full_name} | ${e.position} | ${e.department_id} | ${e.shift_id} | ${e.status} | ${e.system_role} | user=${e.user_id ? "CO" : "-"}`);

const { data: depts } = await admin.from("departments").select("id, name, manager_id").eq("company_id", C);
console.log(`\n--- ${depts.length} PHONG BAN ---`);
for (const d of depts) console.log(`${d.id} | ${d.name} | manager=${d.manager_id ?? "-"}`);

const { data: shifts } = await admin.from("shifts").select("id, name, code, start_time, end_time, break_minutes, working_days, status").eq("company_id", C);
console.log(`\n--- ${shifts.length} CA ---`);
for (const s of shifts) console.log(`${s.id} | ${s.name} | ${s.start_time}-${s.end_time} | nghi ${s.break_minutes}p | ngay ${JSON.stringify(s.working_days)} | ${s.status}`);

const { data: st } = await admin.from("company_settings").select("*").eq("company_id", C).maybeSingle();
console.log("\n--- CAU HINH ---"); console.log(JSON.stringify(st, null, 2));

const { data: ot } = await admin.from("overtime_rules").select("rule_key, multiplier, effective_from").eq("company_id", C).order("rule_key");
console.log("\n--- HE SO TANG CA ---"); for (const r of ot) console.log(`${r.rule_key} = ${r.multiplier} tu ${r.effective_from}`);

const { data: rates } = await admin.from("employee_pay_rates").select("employee_id, unit, amount, effective_from").eq("company_id", C);
console.log(`\n--- MUC LUONG: ${rates.length} dong ---`);

const { data: adj } = await admin.from("pay_adjustments").select("id, name, kind, value_type, value, basis, is_active").eq("company_id", C);
console.log(`--- KHOAN PHU CAP/KHAU TRU: ${adj.length} ---`);

const { count: attJul } = await admin.from("attendance_records").select("id", { count: "exact", head: true })
  .eq("company_id", C).gte("work_date", "2026-07-01").lt("work_date", "2026-08-01");
const { count: attAll } = await admin.from("attendance_records").select("id", { count: "exact", head: true }).eq("company_id", C);
console.log(`\n--- CHAM CONG: ${attAll} tong, ${attJul} trong thang 7/2026 ---`);

const { data: periods } = await admin.from("periods").select("start_date, status").eq("company_id", C).order("start_date");
console.log("--- KY CONG ---"); for (const p of periods) console.log(`${p.start_date} | ${p.status}`);

const { data: runs } = await admin.from("payroll_runs").select("period_start").eq("company_id", C);
console.log(`--- BAN CHOT LUONG: ${runs.length} ---`);

const { data: holidays } = await admin.from("holidays").select("holiday_date, name").eq("company_id", C).gte("holiday_date","2026-07-01").lt("holiday_date","2026-08-01");
console.log(`--- NGAY LE THANG 7: ${holidays.length} ---`); for (const h of holidays) console.log(`${h.holiday_date} ${h.name}`);
