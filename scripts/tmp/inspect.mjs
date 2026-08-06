import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: companies } = await admin.from("companies").select("id, name, code");
for (const c of companies ?? []) {
  const { count } = await admin.from("employees").select("id", { count: "exact", head: true }).eq("company_id", c.id);
  if ((count ?? 0) > 0) console.log(`${c.id}  |  ${c.name}  |  ${count} nhan vien`);
}
