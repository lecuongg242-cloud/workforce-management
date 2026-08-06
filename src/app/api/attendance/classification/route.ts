import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import {
  classifyDay,
  loadCompanyRules,
  type ShiftRuleInfo,
} from "@/lib/attendance/classification-context";
import { groupAttendanceByDay, shiftBreakInfoById } from "@/lib/attendance/day";
import { shiftMonth } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  attendanceClassificationListResponseSchema,
  attendanceRecordSchema,
  attendanceSummaryQuerySchema,
} from "@/lib/validation/api/attendance";

/**
 * Phan loai TUNG NGAY cong cua mot nhan vien trong mot thang (SET-04, plan
 * 04-05): loai ngay, phut dem, phut tang ca, gio quy doi.
 *
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. Dung CHUNG phep gop ngay
 * (`groupAttendanceByDay`) va CHUNG mo-dun phan loai
 * (`classification-context.ts`) voi `GET /api/attendance/summary`, nen tong
 * thang va tung ngay khong the lech nhau.
 *
 * Lop quyen (AUTH-03) giong `summary`: `employee`/`manager` chi hoi duoc
 * chinh minh.
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
        .select("id, break_minutes, start_time, end_time, working_days")
        .eq("company_id", companyId),
    ]);

    if (error || shiftsError) {
      return NextResponse.json(
        { error: "Không thể tải phân loại công." },
        { status: 500 },
      );
    }

    const records = ((data ?? []) as unknown[]).map((row) =>
      attendanceRecordSchema.parse(row),
    );
    const rawShifts = (shiftRows ?? []) as Array<{
      id: string;
      break_minutes: number;
      start_time: string;
      end_time: string;
      working_days: number[];
    }>;

    const breaks = shiftBreakInfoById(
      rawShifts.map((row) => ({
        id: row.id,
        breakMinutes: row.break_minutes,
        startTime: row.start_time.slice(0, 5),
        endTime: row.end_time.slice(0, 5),
      })),
    );

    const shiftRules = new Map<string, ShiftRuleInfo>(
      rawShifts.map((row) => {
        const info = breaks[row.id];
        return [
          row.id,
          {
            workingDays: row.working_days as ShiftRuleInfo["workingDays"],
            scheduledMinutes: Math.max(
              (info?.shiftMinutes ?? 0) - (info?.breakMinutes ?? 0),
              0,
            ),
          },
        ];
      }),
    );

    const days = groupAttendanceByDay(records, breaks);
    const rules = await loadCompanyRules({ companyId, fromDate: start, toDate: end });

    const items = days.map((day) => {
      const classification = classifyDay({
        day,
        shift: shiftRules.get(day.shiftId),
        rules,
      });
      return {
        date: day.date,
        workedMinutes: day.workedMinutes,
        ...classification,
      };
    });

    return NextResponse.json(
      attendanceClassificationListResponseSchema.parse(items),
    );
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      return NextResponse.json(
        attendanceClassificationListResponseSchema.parse([]),
      );
    }
    console.error("Lỗi không xác định ở GET /api/attendance/classification:", cause);
    return NextResponse.json(
      { error: "Không thể tải phân loại công." },
      { status: 500 },
    );
  }
}
