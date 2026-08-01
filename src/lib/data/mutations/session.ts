"use server";

import { cookies } from "next/headers";

import { ACTIVE_COMPANY_COOKIE } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Dang xuat that: xoa phien Supabase (cookie do @supabase/ssr quan ly) roi
 * xoa them cookie doanh nghiep hien hanh — gop du hai chan de khong con cua
 * so nao truy cap duoc sau khi dang xuat (AUTH-01).
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_COMPANY_COOKIE);
}
