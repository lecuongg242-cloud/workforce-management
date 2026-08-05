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
const CHANGE_PASSWORD_PATH = "/doi-mat-khau";

/**
 * Middleware chi doc duoc JWT, ma vai tro nam o bang `memberships` (AUTH-03).
 * Nen moi khi da co claims ma can dua nguoi dung "vao trong", no chi tra ve
 * `/` — `src/app/page.tsx` phan giai vai tro roi re tiep toi `/admin/dashboard`
 * hoac `/employee`.
 */
const HOME_PATH = "/";

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
 * `mustChangePassword` doc tu nhanh `app_metadata` PHIA SERVER cua JWT (D-16)
 * — TUYET DOI khong doc tu nhanh metadata ma client sua duoc qua
 * `supabase.auth.updateUser()`. Hai quy tac cua co nay XEP TRUOC quy tac bao
 * ve route hien co (D-16, plan 02-10):
 * - Co bat va duong dan KHONG phai `/doi-mat-khau` va KHONG phai `/login` ->
 *   chuyen huong toi `/doi-mat-khau`. Bao gom ca `/select-company` — nguoi
 *   chua doi mat khau khong duoc lam gi khac.
 * - Co bat va duong dan LA `/doi-mat-khau` -> cho qua.
 * Khi co TAT: `/doi-mat-khau` tu chuyen huong ra ngoai (ve `HOME_PATH` neu co
 * claims, ve login neu khong) de nguoi da doi xong khong quay lai duoc trang
 * do va boi roi.
 */
export function resolveGate({
  pathname,
  hasClaims,
  mustChangePassword,
}: {
  pathname: string;
  hasClaims: boolean;
  mustChangePassword: boolean;
}): GateResult {
  const isChangePasswordPath = pathname === CHANGE_PASSWORD_PATH;

  if (mustChangePassword) {
    if (isChangePasswordPath) {
      return { action: "pass" };
    }
    if (pathname !== "/login") {
      return { action: "redirect", to: CHANGE_PASSWORD_PATH };
    }
    // pathname === "/login" voi co bat: khong co quy tac rieng o day, roi
    // xuong cac quy tac hien co ben duoi (vd co claims -> HOME_PATH,
    // roi lan ke tiep se lai bi day ve /doi-mat-khau — canh tinh co chu y,
    // khong xay ra vong lap vo han vi moi buoc deu tien ve mot trang khac).
  } else if (isChangePasswordPath) {
    return hasClaims
      ? { action: "redirect", to: HOME_PATH }
      : { action: "redirect", to: "/login" };
  }

  if (isProtectedPath(pathname) && !hasClaims) {
    return { action: "redirect", to: "/login" };
  }
  if (pathname === "/login" && hasClaims) {
    return { action: "redirect", to: HOME_PATH };
  }
  return { action: "pass" };
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { supabaseResponse, claims } = await updateSession(request);

  const appMetadata =
    (claims?.app_metadata as { must_change_password?: boolean } | undefined) ??
    {};

  const gate = resolveGate({
    pathname: request.nextUrl.pathname,
    hasClaims: claims !== null,
    mustChangePassword: appMetadata.must_change_password === true,
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
