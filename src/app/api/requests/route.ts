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
  requestQuerySchema,
  workRequestListResponseSchema,
  workRequestSchema,
} from "@/lib/validation/api/requests";

/**
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. Sap xep theo `created_at`
 * GIAM DAN roi `id` TANG DAN — tiebreaker la BAT BUOC vi seed tao nhieu yeu
 * cau trong cung mot lan chay nen thoi diem tao trung nhau la chuyen thuong
 * (T-02-09-06).
 *
 * Lop quyen (AUTH-03): vai tro `employee`/`manager` hoi `employeeId` khac
 * `employeeId` cua chinh phien bi tu choi (403). Khong truyen `employeeId`
 * thi mac dinh gioi han ve `employeeId` cua chinh phien cho hai vai tro do;
 * `owner`/`admin` thay toan bo doanh nghiep khi khong truyen `employeeId`.
 */
export const dynamic = "force-dynamic";

const WORK_REQUEST_COLUMNS =
  "id, company_id, employee_id, type, status, from_date, to_date, from_time, to_time, reason, created_at, reviewer_id, review_note";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId, role, employeeId: sessionEmployeeId } =
      await getSessionContext();

    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const queryParams = requestQuerySchema.parse(rawQuery);

    const isAdminRole = role === "owner" || role === "admin";
    if (
      !isAdminRole &&
      queryParams.employeeId &&
      queryParams.employeeId !== sessionEmployeeId
    ) {
      throw new ForbiddenError();
    }

    // Khong truyen employeeId: quan tri thay toan bo doanh nghiep, hai vai
    // tro con lai mac dinh gioi han ve chinh minh (khong phai bo qua loc).
    const effectiveEmployeeId =
      queryParams.employeeId ?? (isAdminRole ? undefined : (sessionEmployeeId ?? undefined));

    const supabase = await createServerSupabase();
    let query = supabase
      .from("work_requests")
      .select(WORK_REQUEST_COLUMNS)
      .eq("company_id", companyId);

    if (effectiveEmployeeId) {
      query = query.eq("employee_id", effectiveEmployeeId);
    }
    if (queryParams.status && queryParams.status !== "all") {
      query = query.eq("status", queryParams.status);
    }

    query = query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "Không thể tải danh sách yêu cầu." },
        { status: 500 },
      );
    }

    const items = ((data ?? []) as unknown[]).map((row) =>
      workRequestSchema.parse(row),
    );
    return NextResponse.json(workRequestListResponseSchema.parse(items));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon duoc doanh nghiep nao -- danh sach rong la du
      // lieu hop le, khong phai loi (dong bo voi GET /api/attendance).
      return NextResponse.json(workRequestListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/requests:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách yêu cầu." },
      { status: 500 },
    );
  }
}
