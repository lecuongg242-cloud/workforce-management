import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase phia trinh duyet.
 *
 * CHI dung cho `signInWithPassword` / `signOut` / `updateUser` trong
 * `src/lib/auth/session-provider.tsx`. KHONG bao gio dung client nay de truy
 * van du lieu nghiep vu (bang, RPC) — moi doc/ghi du lieu di qua Route
 * Handler (doc) hoac Server Action (ghi), theo D-12.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
