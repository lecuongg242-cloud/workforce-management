import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getActiveSupportSession,
  getSessionContext,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import { companyListResponseSchema } from "@/lib/validation/api/companies";
import type { Company } from "@/lib/types/domain";

/**
 * Khuon cho moi Route Handler doc ve sau (D-12). File nay chi xuat `dynamic`
 * va `GET` — them bat ky ham HTTP nao khac vao mot file duoi `src/app/api/`
 * la mot lo CSRF, vi Route Handler xac thuc bang cookie khong co kiem tra
 * nguon gui nhu Server Action (D-12c). `src/__tests__/route-handlers-get-only.test.ts`
 * (Task 3) la cong co hoc chan dieu do.
 */
export const dynamic = "force-dynamic";

interface MembershipListRow {
  company_id: string;
  role: Company["role"];
  last_accessed_at: string | null;
}

interface CompanyRow {
  id: string;
  name: string;
  code: string;
  industry: string;
  size: Company["size"];
  phone: string;
  address: string;
  accent: Company["accent"];
  created_at: string;
}

/**
 * Danh sach doanh nghiep cua MOT nguoi dung — khong lien quan den khai niem
 * "doanh nghiep hien hanh". Sap xep XAC DINH: `last_accessed_at` giam dan
 * voi NULL xuong cuoi, roi `company_id` tang dan lam tiebreaker.
 */
async function loadCompaniesForUser(userId: string): Promise<Company[]> {
  const supabase = await createServerSupabase();

  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("company_id, role, last_accessed_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("last_accessed_at", { ascending: false, nullsFirst: false })
    .order("company_id", { ascending: true });

  if (membershipsError) {
    throw new Error("Không thể tải danh sách doanh nghiệp.");
  }

  const rows = (memberships ?? []) as MembershipListRow[];
  if (rows.length === 0) return [];

  const companyIds = rows.map((row) => row.company_id);

  const [{ data: companies, error: companiesError }, { data: employeeRows, error: employeesError }] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id, name, code, industry, size, phone, address, accent, created_at")
        .in("id", companyIds),
      supabase.from("employees").select("company_id").in("company_id", companyIds),
    ]);

  if (companiesError || employeesError) {
    throw new Error("Không thể tải danh sách doanh nghiệp.");
  }

  const employeeCountByCompany = new Map<string, number>();
  for (const row of (employeeRows ?? []) as Array<{ company_id: string }>) {
    employeeCountByCompany.set(
      row.company_id,
      (employeeCountByCompany.get(row.company_id) ?? 0) + 1,
    );
  }

  const companyById = new Map(
    ((companies ?? []) as CompanyRow[]).map((row) => [row.id, row]),
  );

  return rows.map((row) => {
    const company = companyById.get(row.company_id);
    if (!company) {
      throw new Error("Dữ liệu doanh nghiệp không nhất quán.");
    }
    return {
      id: company.id,
      name: company.name,
      code: company.code,
      industry: company.industry,
      size: company.size,
      phone: company.phone,
      address: company.address,
      role: row.role,
      employeeCount: employeeCountByCompany.get(company.id) ?? 0,
      lastAccessedAt: row.last_accessed_at ?? company.created_at,
      accent: company.accent,
    } satisfies Company;
  });
}

/**
 * Doanh nghiep dang duoc mo bang mot phien ho tro, neu co (D-53 muc 2).
 *
 * `role: "support"` di kem trong hinh dang `Company` de giao dien phan biet
 * duoc no voi mot membership that — day la LY DO `Company.role` mang kieu
 * `AccessRole`. Phep doc duoi day di qua RLS binh thuong: no chi thanh cong
 * vi `companies_select_member` da co nhanh `tf_has_support_access` (0034).
 */
async function loadSupportCompany(): Promise<Company | null> {
  const support = await getActiveSupportSession();
  if (!support) return null;

  const supabase = await createServerSupabase();

  const [{ data: company, error: companyError }, { count, error: countError }] =
    await Promise.all([
      supabase
        .from("companies")
        .select(
          "id, name, code, industry, size, phone, address, accent, created_at",
        )
        .eq("id", support.companyId)
        .maybeSingle(),
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", support.companyId),
    ]);

  if (companyError || countError || !company) return null;
  const row = company as CompanyRow;

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    industry: row.industry,
    size: row.size,
    phone: row.phone,
    address: row.address,
    role: "support",
    employeeCount: count ?? 0,
    lastAccessedAt: row.created_at,
    accent: row.accent,
  } satisfies Company;
}

export async function GET(): Promise<NextResponse> {
  try {
    const context = await getSessionContext();
    const companies = await loadCompaniesForUser(context.userId);
    const parsed = companyListResponseSchema.parse(companies);
    return NextResponse.json(parsed);
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError) {
      // Phien ho tro (D-51/D-53): platform admin khong co membership nao, nen
      // nhanh tren tra ve mang rong — va `AdminShell` dung chinh danh sach nay
      // de tim ten doanh nghiep hien hanh (admin-shell.tsx:36,50). Khong co
      // nhanh nay thi sidebar va banner ho tro deu khong biet minh dang o dau.
      const supportCompanies = await loadSupportCompany();
      if (supportCompanies) {
        return NextResponse.json(
          companyListResponseSchema.parse([supportCompanies]),
        );
      }
      // Rong la du lieu hop le -- khong bao gio tra 404/500 cho "chua thuoc
      // doanh nghiep nao".
      return NextResponse.json([]);
    }
    if (cause instanceof NoActiveCompanyError) {
      // Endpoint nay khong can "doanh nghiep hien hanh" -- tra ve day du
      // danh sach ma nguoi nay la thanh vien.
      const companies = await loadCompaniesForUser(cause.userId);
      const parsed = companyListResponseSchema.parse(companies);
      return NextResponse.json(parsed);
    }
    console.error("Lỗi không xác định ở GET /api/companies:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách doanh nghiệp." },
      { status: 500 },
    );
  }
}
