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
  employeeDetailResponseSchema,
  employeeRowSchema,
} from "@/lib/validation/api/employees";

/**
 * Khuon 02-04/02-05 (D-12): chi xuat `dynamic` va `GET`. `id` la dinh danh
 * THUC THE doc tu tham so duong dan — D-12b cam nhan dinh danh DOANH NGHIEP
 * tu client, khong cam id thuc the, vi id thuc the luon duoc loc lai theo
 * `company_id` cua session (dong duoi). Tra `null` voi ma 200 khi khong tim
 * thay hoac id thuoc doanh nghiep khac (khong phai 404) de khong ai phan
 * biet duoc hai truong hop do voi nhau (T-02-07-01) va de hinh dang tra ve
 * khop `Promise<Employee | null>` cua chu ky cu (`getEmployee`).
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const { companyId } = await getSessionContext();
    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Không thể tải hồ sơ nhân viên." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(employeeDetailResponseSchema.parse(null));
    }

    const employee = employeeRowSchema.parse(data);
    return NextResponse.json(employeeDetailResponseSchema.parse(employee));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon duoc doanh nghiep nao -- ho so rong la du lieu
      // hop le (dong bo voi GET /api/employees, GET /api/companies).
      return NextResponse.json(employeeDetailResponseSchema.parse(null));
    }
    console.error("Lỗi không xác định ở GET /api/employees/[id]:", cause);
    return NextResponse.json(
      { error: "Không thể tải hồ sơ nhân viên." },
      { status: 500 },
    );
  }
}
