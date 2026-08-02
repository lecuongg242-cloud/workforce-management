import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  workSiteListResponseSchema,
  workSiteRowSchema,
} from "@/lib/validation/api/work-sites";

/** Khuon 02-04/03-01 (D-12c): chi xuat `dynamic` va `GET`. */
export const dynamic = "force-dynamic";

const WORK_SITE_COLUMNS =
  "id, company_id, name, latitude, longitude, radius_meters, is_active, created_at";

/**
 * Sap xep xac dinh: `name` tang dan roi `id` tang dan. Tra ve CA diem dang
 * dung lan diem da ngung — man hinh `/admin/work-sites` tu phan nhom qua co
 * `isActive`; duong ghi cham cong doc diem dang dung qua rieng mot truy van
 * khac (Server Action `checkIn`), khong qua Route Handler nay.
 */
async function loadWorkSitesForCompany(companyId: string) {
  const supabase = await createServerSupabase();

  const { data: workSites, error } = await supabase
    .from("work_sites")
    .select(WORK_SITE_COLUMNS)
    .eq("company_id", companyId)
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Không thể tải danh sách điểm làm việc.");
  }

  return ((workSites ?? []) as unknown[]).map((row) => workSiteRowSchema.parse(row));
}

export async function GET(): Promise<NextResponse> {
  try {
    const { companyId } = await getSessionContext();
    const workSites = await loadWorkSitesForCompany(companyId);
    const parsed = workSiteListResponseSchema.parse(workSites);
    return NextResponse.json(parsed);
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon duoc doanh nghiep nao -- danh sach rong la du
      // lieu hop le, khong phai loi (dong bo voi GET /api/shifts).
      return NextResponse.json(workSiteListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/work-sites:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách điểm làm việc." },
      { status: 500 },
    );
  }
}
