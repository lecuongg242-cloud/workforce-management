import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { JwtPayload } from "@supabase/supabase-js";

export interface UpdateSessionResult {
  supabaseResponse: NextResponse;
  claims: JwtPayload | null;
}

/**
 * Refresh phien Supabase trong middleware va tra ve DUNG response da ghi
 * cookie moi len — day la diem de sai nhat cua ca lat cat (Pitfall 1,
 * 02-RESEARCH.md). Chi mot bien `supabaseResponse` duy nhat trong toan bo
 * ham; khi `setAll` chay, no ghi cookie len `request.cookies` truoc, TAO LAI
 * `supabaseResponse` bang chinh request da co cookie moi, roi ghi cookie len
 * response moi do. Khong bao gio tao mot `NextResponse` khac o cuoi ham roi
 * co copy cookie qua — API do khong ton tai tren `ResponseCookies`.
 */
export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Bat buoc tao lai response SAU khi set request.cookies, roi ghi
          // lai tren response -- day la buoc hay bi bo sot gay mat cookie.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Khong chen logic nao giua luc tao client va luc doc claims.
  const { data } = await supabase.auth.getClaims();

  return { supabaseResponse, claims: data?.claims ?? null };
}
