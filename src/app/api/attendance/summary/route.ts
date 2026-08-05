import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { groupAttendanceByDay, shiftBreakInfoById } from "@/lib/attendance/day";
import { shiftMonth } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  attendanceRecordSchema,
  attendanceSummaryQuerySchema,
  monthlySummarySchema,
} from "@/lib/validation/api/attendance";

/**
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. Tra `MonthlySummary`
 * tinh tu tap ban ghi chuan cong trong thang o tang ung dung (quy mo du an
 * chua can toi uu bang mot RPC tong hop, xem CLAUDE.md §Constraints). Thang
 * khong co ban ghi tra ve ban tong hop TOAN SO 0 voi `month` dung bang tham
 * so — khong tra `null`, khong tra loi (edge DATA-05 empty).
 *
 * Lop quyen (AUTH-03): vai tro `employee`/`manager` hoi `employeeId` khac
 * cua chinh phien bi tu choi (403).
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
    const queryParams = attendanceSummaryQuerySchema.parse(rawQuery);

    const isAdminRole = role === "owner" || role === "admin";
    if (!isAdminRole && queryParams.employeeId !== sessionEmployeeId) {
      throw new ForbiddenError();
    }

    const supabase = await createServerSupabase();
    const start = `${queryParams.month}-01`;
    const end = `${shiftMonth(queryParams.month, 1)}-01`;

    // Doc CA cung voi ban ghi: tu migration 0014, gio nghi duoc tru mot lan
    // cho moi NGAY (khong phai moi dong), nen tong hop thang phai di qua
    // dung phep gop ngay ma giao dien dung — neu tinh rieng o day thi hai
    // noi se lech nhau va khong ai biet ben nao dung.
    const [
      { data, error },
      { data: shiftRows, error: shiftsError },
    ] = await Promise.all([
      supabase
        .from("attendance_records")
        .select(ATTENDANCE_COLUMNS)
        .eq("company_id", companyId)
        .eq("employee_id", queryParams.employeeId)
        .gte("work_date", start)
        .lt("work_date", end),
      supabase
        .from("shifts")
        .select("id, break_minutes, start_time, end_time")
        .eq("company_id", companyId),
    ]);

    if (error || shiftsError) {
      return NextResponse.json(
        { error: "Không thể tải tổng hợp công tháng." },
        { status: 500 },
      );
    }

    const records = ((data ?? []) as unknown[]).map((row) =>
      attendanceRecordSchema.parse(row),
    );
    const breaks = shiftBreakInfoById(
      (
        (shiftRows ?? []) as Array<{
          id: string;
          break_minutes: number;
          start_time: string;
          end_time: string;
        }>
      ).map((row) => ({
        id: row.id,
        breakMinutes: row.break_minutes,
        // `time` cua Postgres ve dang "HH:mm:ss" — cat con "HH:mm" cho khop
        // voi `minutesBetween()`.
        startTime: row.start_time.slice(0, 5),
        endTime: row.end_time.slice(0, 5),
      })),
    );

    // Tu migration 0013 mot ngay co the co NHIEU dong (nhieu luot vao/ra), va
    // tu 0014 gio nghi duoc tru mot lan cho moi ngay. Gop ngay roi mo, khong
    // cong thang cac dong: cong dong se ra tong LON HON so gio duoc tinh
    // cong, va se dem mot ngay ra ngoai an trua thanh hai "ngay cong".
    const days = groupAttendanceByDay(records, breaks);

    const summary = {
      month: queryParams.month,
      workedDays: days.filter((day) => day.workedMinutes > 0).length,
      totalMinutes: days.reduce((sum, day) => sum + day.workedMinutes, 0),
      // Chi luot DAU TIEN cua ngay mang status "late" (xem `checkIn`), va
      // `day.status` da lay tu luot do — dem ngay o day chinh la so ngay di
      // muon.
      lateCount: days.filter((day) => day.status === "late").length,
      leaveDays: days.filter(
        (day) => day.status === "leave_paid" || day.status === "leave_unpaid",
      ).length,
    };

    return NextResponse.json(monthlySummarySchema.parse(summary));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon duoc doanh nghiep nao -- KHONG the suy ra
      // `month` tu query (chua chac hop le), nen van chan lai o day thanh
      // loi 400 thay vi doan mo mot ban tong hop toan so 0.
      return NextResponse.json(
        { error: "Vui lòng chọn doanh nghiệp bạn muốn truy cập." },
        { status: 400 },
      );
    }
    console.error("Lỗi không xác định ở GET /api/attendance/summary:", cause);
    return NextResponse.json(
      { error: "Không thể tải tổng hợp công tháng." },
      { status: 500 },
    );
  }
}
