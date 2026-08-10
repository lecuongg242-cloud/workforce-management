import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  canReadCompanyData,
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
 * GIAM DAN, roi trong cung mot ngay sap theo `check_in_at` TANG DAN — tu
 * migration 0013 mot ngay co the co NHIEU luot cham cong, va thu tu luot phai
 * la thu tu thoi gian that (`id` la UUID nen khong dung lam thu tu duoc).
 *
 * Lop quyen (AUTH-03): vai tro `employee`/`manager` hoi `employeeId` khac
 * `employeeId` cua chinh phien bi tu choi (403). `owner`/`admin` doc duoc
 * moi nhan vien trong doanh nghiep.
 *
 * PHAM VI MAC DINH, KHONG PHAI PHAM VI TUY CHON. `employeeId` la tham so
 * KHONG BAT BUOC, nen phep kiem "hoi nguoi khac thi 403" o tren mot minh no
 * KHONG DU: bo trong tham so thi khong con gi de so sanh, va truoc ban va nay
 * mot nhan vien goi `?month=2026-07` doc duoc cham cong CUA CA DOANH NGHIEP —
 * RLS `tf_is_member` cho qua vi ho dung la thanh vien.
 *
 * Vi vay pham vi duoc tinh THANH MOT GIA TRI (`effectiveEmployeeId`) roi moi
 * dua vao truy van, thay vi de dieu kien loc phu thuoc vao viec client co gui
 * tham so hay khong. Khuon nay giong `GET /api/requests`.
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

    const isAdminRole = canReadCompanyData(role);
    if (
      !isAdminRole &&
      queryParams.employeeId &&
      queryParams.employeeId !== sessionEmployeeId
    ) {
      throw new ForbiddenError();
    }

    // Khong truyen `employeeId`: quan tri thay toan bo doanh nghiep, hai vai
    // tro con lai mac dinh gioi han ve chinh minh — KHONG phai bo qua loc.
    //
    // `sessionEmployeeId` co the la `null` (tai khoan da co membership nhung
    // chua gan voi mot dong `employees`). Khi ay mot nguoi khong phai quan tri
    // KHONG co pham vi nao hop le, va cau tra loi dung la RONG — de roi vao
    // nhanh "khong loc gi" se bien dung cai lo hong vua va.
    const isSelfScoped = !isAdminRole;
    const effectiveEmployeeId = queryParams.employeeId ?? sessionEmployeeId;

    if (isSelfScoped && !effectiveEmployeeId) {
      return NextResponse.json(attendanceListResponseSchema.parse([]));
    }

    const supabase = await createServerSupabase();
    let query = supabase
      .from("attendance_records")
      .select(ATTENDANCE_COLUMNS)
      .eq("company_id", companyId);

    if (isSelfScoped || queryParams.employeeId) {
      query = query.eq("employee_id", effectiveEmployeeId as string);
    }
    if (queryParams.month) {
      const start = `${queryParams.month}-01`;
      const end = `${shiftMonth(queryParams.month, 1)}-01`;
      query = query.gte("work_date", start).lt("work_date", end);
    }
    if (queryParams.date) {
      query = query.eq("work_date", queryParams.date);
    }

    // Trong cung mot ngay co the co NHIEU luot cham cong (migration 0013), va
    // `id` la UUID nen khong phan anh thu tu thoi gian — sap theo check_in_at
    // de "luot 1, luot 2" o giao dien dung la thu tu that. `id` giu lai lam
    // tiebreaker cuoi cho hai dong khong co gio vao (nghi phep) cua cung ngay.
    query = query
      .order("work_date", { ascending: false })
      .order("check_in_at", { ascending: true, nullsFirst: true })
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
