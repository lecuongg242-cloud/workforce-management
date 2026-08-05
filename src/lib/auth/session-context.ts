import { cookies } from "next/headers";

import { createServerSupabase } from "@/lib/supabase/server";
import type { CompanyRole, UserSession } from "@/lib/types/domain";

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

export interface SessionContext {
  userId: string;
  email: string;
  companyId: string;
  role: CompanyRole;
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
  if (rows.length === 0) throw new NoMembershipError();

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

export function requireRole(role: CompanyRole, allowed: CompanyRole[]): void {
  if (!allowed.includes(role)) {
    throw new ForbiddenError();
  }
}

/**
 * Vai tro duoc vao khu vuc `/admin`. Ranh gioi nay TRUNG voi `isAdminRole`
 * (`owner`/`admin`) da dung o moi Route Handler va Server Action theo AUTH-03:
 * `manager` va `employee` chi doc duoc du lieu cua CHINH HO, nen man hinh
 * quan tri voi ho se rong hoac 403 — dua ho vao giao dien nhan vien moi dung.
 */
export const ADMIN_AREA_ROLES: CompanyRole[] = ["owner", "admin"];

export function canAccessAdminArea(role: CompanyRole): boolean {
  return ADMIN_AREA_ROLES.includes(role);
}

/**
 * Trang chu theo vai tro. `middleware.ts` KHONG goi duoc ham nay vi vai tro
 * nam o bang `memberships` chu khong o JWT — vi vay moi loi vao sau khi doi
 * phien deu di qua `/` (xem `src/app/page.tsx`) de server phan giai vai tro
 * mot lan roi moi re nhanh.
 */
export function homePathForRole(role: CompanyRole): string {
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
  if (!context || !context.employeeId) return null;

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
