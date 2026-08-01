import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase dung KHOA BI MAT (`SUPABASE_SECRET_KEY`) — bo qua TOAN BO
 * RLS. Module nay CHI DUOC IMPORT tu file co chi thi `"use server"` o dau
 * (Server Action) hoac nam duoi `src/lib/data/mutations/` — khong bao gio tu
 * mot Client Component hay mot file `*-view.tsx`. Cong co hoc canh dieu nay
 * o `src/__tests__/admin-client-scope.test.ts`.
 *
 * Vi client nay bo qua RLS, MOI loi goi qua no PHAI tu kiem quyen (vd
 * `requireRole()`) TRUOC khi cham du lieu — database se KHONG kiem ho, khac
 * voi client cookie-bound o `src/lib/supabase/server.ts`.
 *
 * Khong dung `@supabase/ssr` o day: client nay khong rang buoc cookie va
 * khong giu phien (khac `createServerSupabase()`), moi lan goi la mot lenh
 * doc lap qua Admin API.
 */
export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Thiếu biến môi trường: NEXT_PUBLIC_SUPABASE_URL");
  }

  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Thiếu biến môi trường: SUPABASE_SECRET_KEY");
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
