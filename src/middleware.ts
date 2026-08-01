import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * `middleware.ts` o goc `src/`, cung cap voi `app/` — KHONG doi ten thanh
 * `proxy.ts` theo docs Next.js 16; du an nay ghim `next@^15.0.0` (Pitfall 4,
 * 02-RESEARCH.md).
 */

export type GateAction = "pass" | "redirect";

export interface GateResult {
  action: GateAction;
  to?: string;
}

const PROTECTED_PREFIXES = ["/admin", "/employee"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Logic thuan quyet dinh "duong dan nay di dau" — tach khoi runtime Next de
 * test duoc bang Vitest ma khong phai dung Server Component/middleware that
 * (xem src/__tests__/middleware-gate.test.ts).
 *
 * KHONG xu ly co buoc doi mat khau (`must_change_password`) o day — cong do
 * thuoc plan 02-09; day la khoang trong co chu y, khong phai bo sot.
 */
export function resolveGate({
  pathname,
  hasClaims,
}: {
  pathname: string;
  hasClaims: boolean;
}): GateResult {
  if (isProtectedPath(pathname) && !hasClaims) {
    return { action: "redirect", to: "/login" };
  }
  if (pathname === "/login" && hasClaims) {
    return { action: "redirect", to: "/admin/dashboard" };
  }
  return { action: "pass" };
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { supabaseResponse, claims } = await updateSession(request);

  const gate = resolveGate({
    pathname: request.nextUrl.pathname,
    hasClaims: claims !== null,
  });

  if (gate.action === "redirect" && gate.to) {
    const url = request.nextUrl.clone();
    url.pathname = gate.to;
    const redirectResponse = NextResponse.redirect(url);
    // Chep cookie da ghi tren supabaseResponse sang response redirect, de
    // khong danh mat cookie khac (vd theme/locale) neu co.
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  // Moi nhanh con lai -- tra ve CHINH supabaseResponse, khong tao moi.
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
