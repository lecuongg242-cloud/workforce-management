import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false } });
const C="cty-01";
const { data: wr } = await admin.from("work_requests").select("id, employee_id, reviewer_id, status").eq("company_id", C);
console.log(`work_requests: ${wr.length}`);
const { data: rv } = await admin.from("request_reviews").select("id, request_id").eq("company_id", C);
console.log(`request_reviews: ${rv.length}`);
const { data: notif } = await admin.from("notifications").select("id").eq("company_id", C);
console.log(`notifications: ${notif.length}`);
const { data: photos } = await admin.from("attendance_photos").select("id").eq("company_id", C);
console.log(`attendance_photos: ${photos.length}`);
const { data: emps } = await admin.from("employees").select("id, code").eq("company_id", C).order("code");
console.log(`employees con lai: ${emps.length}`);
