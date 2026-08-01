import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { shiftMonth } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  attendanceListResponseSchema,
  attendanceQuerySchema,
  attendanceRecordSchema,
} from "@/lib/validation/api/attendance";

/**
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. Sap xep theo `work_date`
 * GIAM DAN roi `id` TANG DAN (V1 sap giam dan theo ngay; them `id` lam
 * tiebreaker de thu tu on dinh khi mot nhan vien co nhieu ban ghi cung ngay
 * o cac ca khac nhau).
 *
 * Lop quyen (AUTH-03): vai tro `employee`/`manager` hoi `employeeId` khac
 * `employeeId` cua chinh phien bi tu choi (403). `owner`/`admin` doc duoc
 * moi nhan vien trong doanh nghiep.
 */
export const dynamic = "force-dynamic";

const ATTENDANCE_COLUMNS =
  "id, company_id, employee_id, work_date, shift_id, check_in_at, check_out_at, worked_minutes, late_minutes, early_leave_minutes, status, location, needs_supplement, note";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId, role, employeeId: sessionEmployeeId } =
      await getSessionContext();

    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const queryParams = attendanceQuerySchema.parse(rawQuery);

    const isAdminRole = role === "owner" || role === "admin";
    if (
      !isAdminRole &&
      queryParams.employeeId &&
      queryParams.employeeId !== sessionEmployeeId
    ) {
      throw new ForbiddenError();
    }

    const supabase = await createServerSupabase();
    let query = supabase
      .from("attendance_records")
      .select(ATTENDANCE_COLUMNS)
      .eq("company_id", companyId);

    if (queryParams.employeeId) {
      query = query.eq("employee_id", queryParams.employeeId);
    }
    if (queryParams.month) {
      const start = `${queryParams.month}-01`;
      const end = `${shiftMonth(queryParams.month, 1)}-01`;
      query = query.gte("work_date", start).lt("work_date", end);
    }
    if (queryParams.date) {
      query = query.eq("work_date", queryParams.date);
    }

    query = query
      .order("work_date", { ascending: false })
      .order("id", { ascending: true });

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "Không thể tải danh sách chấm công." },
        { status: 500 },
      );
    }

    const items = ((data ?? []) as unknown[]).map((row) =>
      attendanceRecordSchema.parse(row),
    );
    return NextResponse.json(attendanceListResponseSchema.parse(items));
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
      return NextResponse.json(attendanceListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/attendance:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách chấm công." },
      { status: 500 },
    );
  }
}
