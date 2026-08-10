import { cookies } from "next/headers";

import { createServerSupabase } from "@/lib/supabase/server";
import type { AccessRole, CompanyRole, UserSession } from "@/lib/types/domain";

/**
 * Diem chan danh tinh DUY NHAT phia server (D-12a). Moi Route Handler va moi
 * Server Action goi `getSessionContext()` truoc bat ky logic nghiep vu nao.
 * Ham nay KHONG NHAN THAM SO va khong doc tham so truy van hay dia chi cua
 * request o bat ky nhanh nao (D-12b) — company hien hanh chi den tu cookie
 * `tf_active_company`, doi chieu lai voi `memberships` cua chinh nguoi goi.
 */

export const ACTIVE_COMPANY_COOKIE = "tf_active_company";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Bạn cần đăng nhập để tiếp tục.");
    this.name = "UnauthenticatedError";
  }
}

export class NoMembershipError extends Error {
  constructor() {
    super("Tài khoản của bạn chưa thuộc doanh nghiệp nào.");
    this.name = "NoMembershipError";
  }
}

/**
 * `userId` duoc dinh kem de noi goi (vi du Route Handler liet ke doanh
 * nghiep) phuc hoi duoc danh tinh nguoi dung ma khong phai doc lai claims
 * lan thu hai — day khong phai mot gia tri "tin duoc tu client", no chi la
 * ket qua da xac thuc cua chinh lan goi nay.
 */
export class NoActiveCompanyError extends Error {
  constructor(public readonly userId: string) {
    super("Vui lòng chọn doanh nghiệp bạn muốn truy cập.");
    this.name = "NoActiveCompanyError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Bạn không có quyền thực hiện thao tác này.");
    this.name = "ForbiddenError";
  }
}

export type { AccessRole };

export interface SessionContext {
  userId: string;
  email: string;
  companyId: string;
  role: AccessRole;
  employeeId: string | null;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
}

interface MembershipRow {
  company_id: string;
  role: CompanyRole;
}

/**
 * Xac thuc bang `getClaims()` (xac minh chu ky JWT cuc bo qua JWKS, khong
 * round-trip mang — du an da bat ky ky bat doi xung, xem PROJECT.md dong
 * 149-150) va tra ve danh tinh tho. Dung cho nhung thao tac chi can "da dang
 * nhap" ma chua can mot doanh nghiep hien hanh (vi du: tao doanh nghiep dau
 * tien cho chinh minh) — `getSessionContext()` ben duoi doi hoi them mot
 * membership active nen khong dung duoc cho truong hop nay.
 */
export async function getAuthenticatedUser(): Promise<{
  userId: string;
  email: string;
}> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) throw new UnauthenticatedError();
  return { userId: claims.sub, email: claims.email ?? "" };
}

export interface ActiveSupportSession {
  id: string;
  companyId: string;
  /** ISO date-time */
  expiresAt: string;
}

/**
 * Phien ho tro con hieu luc cua NGUOI DANG GOI, neu co (D-49).
 *
 * Ham nay song o day — chu khong o `mutations/platform-sessions.ts` cung ba
 * ham ghi — vi `getSessionContext()` ben duoi phai goi no, va `platform-
 * sessions.ts` thi da import nguoc lai file nay. De o kia se tao mot vong
 * phu thuoc, thu ma `.planning/codebase/ARCHITECTURE.md` ghi ro la khong co
 * trong repo nay.
 *
 * Tra `null` — khong nem — khi chua dang nhap: ham nam tren duong doc cua MOI
 * nguoi dung.
 *
 * Bo loc `platform_admin_id` nam O DAY chu khong pho mac cho RLS. Policy
 * `support_sessions_select_admin_or_member` (0033) CO Y cho thanh vien doanh
 * nghiep doc dong cua nguoi khac — do la tinh nang "khach xem duoc ai da vao
 * du lieu cua minh". Thieu bo loc nay thi mot thanh vien se nham phien cua
 * nguoi khac la phien cua chinh minh.
 */
export async function getActiveSupportSession(): Promise<ActiveSupportSession | null> {
  let userId: string;
  try {
    userId = (await getAuthenticatedUser()).userId;
  } catch {
    return null;
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("support_sessions")
    .select("id, company_id, expires_at")
    .eq("platform_admin_id", userId)
    .is("closed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { id: string; company_id: string; expires_at: string };
  return {
    id: row.id,
    companyId: row.company_id,
    expiresAt: row.expires_at,
  };
}

export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createServerSupabase();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) throw new UnauthenticatedError();

  const userId = claims.sub;
  const email = claims.email ?? "";
  const appMetadata =
    (claims.app_metadata as { must_change_password?: boolean } | undefined) ??
    {};

  const cookieStore = await cookies();
  const activeCompanyCookie =
    cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ?? null;

  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", userId)
    .eq("status", "active");

  if (membershipsError) {
    throw new Error("Không thể xác định doanh nghiệp hiện hành.");
  }

  const rows = (memberships ?? []) as MembershipRow[];

  // Nhanh DUY NHAT ma Phase 6 them vao diem chan danh tinh (D-51): khong
  // membership nao, nhung dang co mot phien ho tro con han khop cookie doanh
  // nghiep hien hanh.
  //
  // Dat SAU phep doc `memberships` la co y: mot platform admin tinh co CO
  // membership van di duong thanh vien binh thuong — quyen ho tro khong bao
  // gio de len quyen that cua chinh ho.
  //
  // Doi chieu `support.companyId === activeCompanyCookie` giu nguyen quy uoc
  // D-12b: doanh nghiep hien hanh den tu cookie roi duoc doi chieu lai voi
  // trang thai phia server, khong bao gio tu mot tham so client gui len.
  if (rows.length === 0) {
    const support = await getActiveSupportSession();
    if (support && support.companyId === activeCompanyCookie) {
      return {
        userId,
        email,
        companyId: support.companyId,
        role: "support",
        employeeId: null,
        isPlatformAdmin: true,
        mustChangePassword: appMetadata.must_change_password === true,
      };
    }
    throw new NoMembershipError();
  }

  const fromCookie = activeCompanyCookie
    ? rows.find((row) => row.company_id === activeCompanyCookie)
    : undefined;

  let active: MembershipRow;
  if (fromCookie) {
    active = fromCookie;
  } else if (rows.length === 1) {
    // Chi tu chon khi CHI CO DUNG MOT lua chon — khong bao gio lay phan tu
    // dau mang lam mac dinh ngam khi co nhieu lua chon (delta gia dinh cua
    // Phase 2, xem 02-04-PLAN.md <objective>).
    active = rows[0];
  } else {
    throw new NoActiveCompanyError(userId);
  }

  const { data: employeeRow } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", active.company_id)
    .maybeSingle();

  let isPlatformAdmin = false;
  const { data: isPlatformAdminResult, error: platformAdminError } =
    await supabase.rpc("tf_is_platform_admin");
  if (platformAdminError) {
    console.error(
      "Không kiểm tra được quyền platform admin:",
      platformAdminError.message,
    );
  } else {
    isPlatformAdmin = isPlatformAdminResult === true;
  }

  return {
    userId,
    email,
    companyId: active.company_id,
    role: active.role,
    employeeId: employeeRow?.id ?? null,
    isPlatformAdmin,
    mustChangePassword: appMetadata.must_change_password === true,
  };
}

export async function getSessionContextOrNull(): Promise<SessionContext | null> {
  try {
    return await getSessionContext();
  } catch (cause) {
    if (
      cause instanceof UnauthenticatedError ||
      cause instanceof NoMembershipError ||
      cause instanceof NoActiveCompanyError ||
      cause instanceof ForbiddenError
    ) {
      return null;
    }
    throw cause;
  }
}

/**
 * Ranh gioi GHI. `allowed` co kieu `CompanyRole[]` chu KHONG phai
 * `AccessRole[]` — co y: khong call site nao them duoc `"support"` vao danh
 * sach cho phep, nen moi Server Action ghi tu dong tu choi phien ho tro ma
 * khong phai sua mot dong nao trong 16 file `mutations/*.ts` (D-52).
 */
export function requireRole(role: AccessRole, allowed: CompanyRole[]): void {
  if (!allowed.includes(role as CompanyRole)) {
    throw new ForbiddenError();
  }
}

/**
 * Ranh gioi DOC du lieu cap doanh nghiep. Dung o MOI Route Handler duoi
 * `src/app/api/`.
 *
 * KHAC `requireRole(role, ["owner","admin"])`: vi ngu do o lai nguyen ven o
 * duong GHI, va chinh vi no khong biet `"support"` ma phien ho tro bi chan.
 * Cho nao quen la cho do CHAN, khong phai cho do LOT — huong hong an toan.
 */
const READ_ROLES: AccessRole[] = ["owner", "admin", "support"];

export function canReadCompanyData(role: AccessRole): boolean {
  return READ_ROLES.includes(role);
}

/**
 * Vai tro duoc vao khu vuc `/admin`. Ranh gioi nay TRUNG voi `isAdminRole`
 * (`owner`/`admin`) da dung o moi Route Handler va Server Action theo AUTH-03:
 * `manager` va `employee` chi doc duoc du lieu cua CHINH HO, nen man hinh
 * quan tri voi ho se rong hoac 403 — dua ho vao giao dien nhan vien moi dung.
 */
export const ADMIN_AREA_ROLES: AccessRole[] = ["owner", "admin", "support"];

export function canAccessAdminArea(role: AccessRole): boolean {
  return ADMIN_AREA_ROLES.includes(role);
}

/**
 * Trang chu theo vai tro. `middleware.ts` KHONG goi duoc ham nay vi vai tro
 * nam o bang `memberships` chu khong o JWT — vi vay moi loi vao sau khi doi
 * phien deu di qua `/` (xem `src/app/page.tsx`) de server phan giai vai tro
 * mot lan roi moi re nhanh.
 */
export function homePathForRole(role: AccessRole): string {
  return canAccessAdminArea(role) ? "/admin/dashboard" : "/employee";
}

/**
 * Dung boi `src/app/layout.tsx` de dung `UserSession` (kieu PHIA CLIENT,
 * khong doi trong domain.ts — xem <objective> cua 02-04-PLAN.md). Tra ve
 * `null` khi nguoi dung da xac thuc nhung chua phan giai duoc CA membership
 * active LAN mot dong `employees` trong doanh nghiep do, nho vay
 * `AppUser.employeeId` giu duoc kieu `string` khong nullable.
 */
export async function getClientSession(): Promise<UserSession | null> {
  const context = await getSessionContextOrNull();
  if (!context) return null;

  // Phien ho tro khong co dong `employees` nao trong doanh nghiep dang xem
  // (D-51). Tra `null` o day nghia la `AdminShell` ket o `AdminShellSkeleton`
  // VINH VIEN — no chi render khi `status === "authenticated" && session`
  // (admin-shell.tsx). Ten hien thi lay email cua chinh platform admin: day
  // la nguoi van hanh TimeFlow, khong phai mot nhan vien co ho so.
  if (context.role === "support") {
    return {
      user: {
        id: context.userId,
        fullName: context.email,
        email: context.email,
        avatarUrl: null,
        employeeId: null,
      },
      companyId: context.companyId,
      role: "support",
      signedInAt: new Date().toISOString(),
    };
  }

  if (!context.employeeId) return null;

  const supabase = await createServerSupabase();
  const { data: employeeRow, error } = await supabase
    .from("employees")
    .select("id, full_name, avatar_url")
    .eq("id", context.employeeId)
    .single();

  if (error || !employeeRow) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedInAt =
    user?.last_sign_in_at ?? user?.created_at ?? new Date(0).toISOString();

  return {
    user: {
      id: context.userId,
      fullName: employeeRow.full_name,
      email: context.email,
      avatarUrl: employeeRow.avatar_url,
      employeeId: employeeRow.id,
    },
    companyId: context.companyId,
    role: context.role,
    signedInAt,
  };
}
