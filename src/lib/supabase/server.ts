import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase phia server, rang buoc cookie phien qua `next/headers`.
 *
 * Dung trong Server Component, Route Handler, va Server Action. Doi voi
 * Server Component: `setAll` co the nem loi vi Server Component khong duoc
 * phep ghi cookie — day la hanh vi da biet va vo hai vi `middleware.ts` da
 * dam nhiem refresh phien; boc `try/catch` la khuon chinh thuc cua
 * `@supabase/ssr`, khong phai cach ne loi tuy tien.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component goi setAll -- bo qua neu middleware da refresh session.
          }
        },
      },
    },
  );
}
