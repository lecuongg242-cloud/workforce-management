import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { WEEKDAY_LABEL } from "@/lib/constants";
import { addDays, formatDayMonth, getWeekday } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import { toVnTime } from "@/lib/validation/api/attendance";
import { dashboardQuerySchema, dashboardSummarySchema } from "@/lib/validation/api/dashboard";
import type { AttendanceChartPoint, AttendanceStatus, RequestType } from "@/lib/types/domain";

/**
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. Tinh toan bo
 * `DashboardSummary` tu du lieu that cua doanh nghiep trong phien — KHONG con
 * hai hang so day so mau co dinh cua tang gia lap V1 dung cho bieu do 7 ngay
 * (T-02-08-06).
 */
export const dynamic = "force-dynamic";

interface RawEmployeeRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
  status: string;
  department_id: string;
  shift_id: string;
  phone: string;
}

interface RawAttendanceRow {
  employee_id: string;
  work_date: string;
  check_in_at: string | null;
  status: string;
  location: string;
}

/**
 * Tu migration 0013, mot nhan vien co the co NHIEU dong trong cung mot ngay
 * (nhieu luot vao/ra). Moi con so o bang dieu khien la "bao nhieu NGUOI", nen
 * phai dem nhan vien RIENG BIET — dem dong se cho ra "30 nguoi da cham cong"
 * o mot doanh nghiep 28 nguoi.
 */
function countDistinctEmployees(records: RawAttendanceRow[]): number {
  return new Set(records.map((record) => record.employee_id)).size;
}

function countByStatusOnDate(records: RawAttendanceRow[]): {
  present: number;
  late: number;
  leave: number;
} {
  return {
    present: countDistinctEmployees(
      records.filter((record) => record.check_in_at !== null),
    ),
    late: countDistinctEmployees(
      records.filter((record) => record.status === "late"),
    ),
    leave: countDistinctEmployees(
      records.filter(
        (record) =>
          record.status === "leave_paid" || record.status === "leave_unpaid",
      ),
    ),
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId } = await getSessionContext();

    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const { date } = dashboardQuerySchema.parse(rawQuery);

    const supabase = await createServerSupabase();
    const rangeStart = addDays(date, -6);

    const [
      { data: employeesData, error: employeesError },
      { data: departmentsData, error: departmentsError },
      { data: shiftsData, error: shiftsError },
      { data: attendanceData, error: attendanceError },
      { data: requestsData, error: requestsError },
    ] = await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name, avatar_url, status, department_id, shift_id, phone")
        .eq("company_id", companyId),
      supabase.from("departments").select("id, name").eq("company_id", companyId),
      supabase.from("shifts").select("id, name").eq("company_id", companyId),
      supabase
        .from("attendance_records")
        .select("employee_id, work_date, check_in_at, status, location")
        .eq("company_id", companyId)
        .gte("work_date", rangeStart)
        .lte("work_date", date),
      supabase
        .from("work_requests")
        .select("type")
        .eq("company_id", companyId)
        .eq("status", "pending"),
    ]);

    if (
      employeesError ||
      departmentsError ||
      shiftsError ||
      attendanceError ||
      requestsError
    ) {
      return NextResponse.json(
        { error: "Không thể tải dữ liệu bảng điều khiển." },
        { status: 500 },
      );
    }

    const employees = (employeesData ?? []) as RawEmployeeRow[];
    const activeEmployees = employees.filter((employee) => employee.status !== "terminated");
    const attendance = (attendanceData ?? []) as RawAttendanceRow[];
    const headcount = employees.length;

    const byWorkDate = new Map<string, RawAttendanceRow[]>();
    for (const record of attendance) {
      const list = byWorkDate.get(record.work_date) ?? [];
      list.push(record);
      byWorkDate.set(record.work_date, list);
    }

    const today = countByStatusOnDate(byWorkDate.get(date) ?? []);
    const yesterday = countByStatusOnDate(byWorkDate.get(addDays(date, -1)) ?? []);
    const onLeaveToday = employees.filter((employee) => employee.status === "on_leave").length;

    const chart: AttendanceChartPoint[] = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(date, index - 6);
      const recordsOfDay = byWorkDate.get(day) ?? [];
      const present = countDistinctEmployees(
        recordsOfDay.filter((record) => record.check_in_at !== null),
      );
      const late = countDistinctEmployees(
        recordsOfDay.filter((record) => record.status === "late"),
      );
      const absent = Math.max(headcount - present, 0);
      return {
        date: day,
        label: `${WEEKDAY_LABEL[getWeekday(day)]} ${formatDayMonth(day)}`,
        present,
        late,
        absent,
      };
    });

    const departmentName = new Map(
      ((departmentsData ?? []) as Array<{ id: string; name: string }>).map((row) => [
        row.id,
        row.name,
      ]),
    );
    const shiftName = new Map(
      ((shiftsData ?? []) as Array<{ id: string; name: string }>).map((row) => [
        row.id,
        row.name,
      ]),
    );
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

    const todayRecords = byWorkDate.get(date) ?? [];
    // Sap xep theo check_in_at (timestamptz ISO) TANG DAN TRUOC khi anh xa
    // sang hinh dang tra ve — so sanh chuoi ISO cho ra dung thu tu thoi gian
    // vi cac dau thoi gian nay la timestamptz that (khong con la chuoi
    // "HH:mm" co the trung nhau nhu tang gia lap).
    // Mot nguoi co the co NHIEU luot trong ngay (migration 0013) — danh sach
    // "hoat dong hom nay" la danh sach NGUOI, moi nguoi dung mot dong voi
    // luot vao SOM NHAT. Loc sau khi da sap tang dan nen dong giu lai chinh
    // la luot dau tien cua nguoi do.
    const seenEmployeeIds = new Set<string>();
    const todayActivity = todayRecords
      .filter((record) => record.check_in_at !== null)
      .sort((a, b) => (a.check_in_at as string).localeCompare(b.check_in_at as string))
      .filter((record) => {
        if (seenEmployeeIds.has(record.employee_id)) return false;
        seenEmployeeIds.add(record.employee_id);
        return true;
      })
      .map((record) => {
        const employee = employeeById.get(record.employee_id);
        return {
          employeeId: record.employee_id,
          employeeName: employee?.full_name ?? "—",
          departmentName: employee ? (departmentName.get(employee.department_id) ?? "—") : "—",
          avatarUrl: employee?.avatar_url ?? null,
          checkIn: toVnTime(record.check_in_at),
          status: record.status as AttendanceStatus,
          location: record.location,
        };
      });

    const checkedInIds = new Set(todayActivity.map((item) => item.employeeId));

    // Nguoi "chua cham cong": van con lam viec, khong nghi phep, chua co ban
    // ghi hom nay. Sap xep XAC DINH theo (full_name, id) de danh sach khong
    // nhay giua hai lan tai.
    const notCheckedIn = activeEmployees
      .filter((employee) => employee.status !== "on_leave")
      .filter((employee) => !checkedInIds.has(employee.id))
      .sort((a, b) => {
        const byName = a.full_name.localeCompare(b.full_name);
        return byName !== 0 ? byName : a.id.localeCompare(b.id);
      })
      .slice(0, 6)
      .map((employee) => ({
        employeeId: employee.id,
        employeeName: employee.full_name,
        departmentName: departmentName.get(employee.department_id) ?? "—",
        avatarUrl: employee.avatar_url,
        phone: employee.phone,
        shiftName: shiftName.get(employee.shift_id) ?? "—",
      }));

    const pendingTypes: RequestType[] = [
      "leave",
      "attendance_supplement",
      "time_adjustment",
      "overtime",
    ];
    const requestRows = (requestsData ?? []) as Array<{ type: string }>;
    const pendingRequests = pendingTypes.map((type) => ({
      type,
      count: requestRows.filter((request) => request.type === type).length,
    }));

    const summary = {
      date,
      // Tong nhan su cua doanh nghiep, ke ca nguoi chua kich hoat tai khoan.
      totalEmployees: { value: headcount, delta: 0 },
      checkedIn: { value: today.present, delta: today.present - yesterday.present },
      late: { value: today.late, delta: today.late - yesterday.late },
      onLeave: { value: onLeaveToday, delta: onLeaveToday - yesterday.leave },
      chart,
      todayActivity,
      pendingRequests,
      notCheckedIn,
    };

    return NextResponse.json(dashboardSummarySchema.parse(summary));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      return NextResponse.json(
        { error: "Vui lòng chọn doanh nghiệp bạn muốn truy cập." },
        { status: 400 },
      );
    }
    console.error("Lỗi không xác định ở GET /api/dashboard:", cause);
    return NextResponse.json(
      { error: "Không thể tải dữ liệu bảng điều khiển." },
      { status: 500 },
    );
  }
}
