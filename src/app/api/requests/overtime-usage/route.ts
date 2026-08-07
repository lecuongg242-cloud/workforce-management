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
} from "@/lib/attendance/classification-context";
import { groupAttendanceByDay } from "@/lib/attendance/day";
import {
  SHIFT_CONTEXT_COLUMNS,
  buildShiftContext,
  type RawShiftContextRow,
} from "@/lib/attendance/shift-context";
import { requestedOvertimeHours } from "@/lib/attendance/overtime-cap";
import { loadCompanySettings } from "@/lib/settings/company-settings";
import { shiftMonth } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  attendanceRecordSchema,
  attendanceSummaryQuerySchema,
} from "@/lib/validation/api/attendance";
import { overtimeUsageSchema } from "@/lib/validation/api/requests";

/**
 * Gio tang ca DA DUNG cua mot nhan vien trong mot thang (SET-05, plan 05-03) —
 * con so ma canh bao vuot tran dua vao. Khuon 02-04 (D-12c): chi xuat `dynamic`
 * va `GET`.
 *
 * HAI PHAN CONG LAI, VA CHUNG LA HAI DAI LUONG KHAC NHAU:
 *
 *   - `actualHours` — gio tang ca THUC TE, tinh tu du lieu cham cong qua
 *     `classification-context.ts`, dung mo-dun cua Phase 4. KHONG co cot nao
 *     luu san con so nay: mot cot dem san se lech voi con so kia ngay lan dau
 *     ai do sua du lieu cham cong (prohibition cua plan).
 *   - `registeredHours` — gio da DANG KY trong cac yeu cau tang ca KHAC da
 *     duoc duyet cua cung thang. Day la phan chua xay ra: nguoi ta da duoc cho
 *     phep nhung chua lam. Bo qua phan nay se lam nguoi duyet ky bon yeu cau
 *     lien tiep ma khong lan nao thay canh bao.
 *
 * Dung `overtimeMinutes` (gio tang ca THAT) chu khong phai `convertedOvertimeHours`
 * (gio QUY DOI theo he so): tran tang ca la mot gioi han ve THOI GIAN LAM VIEC,
 * khong phai ve tien cong. Mot gio lam ngay le van la mot gio.
 *
 * Lop quyen (AUTH-03) giong `GET /api/attendance/classification`:
 * `employee`/`manager` chi hoi duoc chinh minh.
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
    // Yeu cau DANG XET khong duoc tinh vao "da dung" — no la phan `requested`,
    // va cong no o ca hai ve se lam canh bao bao vuot gap doi.
    const excludeRequestId = url.searchParams.get("excludeRequestId");

    const isAdminRole = role === "owner" || role === "admin";
    if (!isAdminRole && queryParams.employeeId !== sessionEmployeeId) {
      throw new ForbiddenError();
    }

    const supabase = await createServerSupabase();
    const start = `${queryParams.month}-01`;
    const end = `${shiftMonth(queryParams.month, 1)}-01`;

    const [settings, attendanceResult, shiftsResult, requestsResult] =
      await Promise.all([
        loadCompanySettings(companyId),
        supabase
          .from("attendance_records")
          .select(ATTENDANCE_COLUMNS)
          .eq("company_id", companyId)
          .eq("employee_id", queryParams.employeeId)
          .gte("work_date", start)
          .lt("work_date", end),
        supabase
          .from("shifts")
          .select(SHIFT_CONTEXT_COLUMNS)
          .eq("company_id", companyId),
        supabase
          .from("work_requests")
          .select("id, from_time, to_time")
          .eq("company_id", companyId)
          .eq("employee_id", queryParams.employeeId)
          .eq("type", "overtime")
          .eq("status", "approved")
          .gte("from_date", start)
          .lt("from_date", end),
      ]);

    if (attendanceResult.error || shiftsResult.error || requestsResult.error) {
      return NextResponse.json(
        { error: "Không thể tính giờ tăng ca đã dùng." },
        { status: 500 },
      );
    }

    const records = ((attendanceResult.data ?? []) as unknown[]).map((row) =>
      attendanceRecordSchema.parse(row),
    );
    const { breaks, shiftRules } = buildShiftContext(
      (shiftsResult.data ?? []) as RawShiftContextRow[],
    );

    const days = groupAttendanceByDay(records, breaks);
    const rules = await loadCompanyRules({ companyId, fromDate: start, toDate: end });

    const actualMinutes = days.reduce((total, day) => {
      const classification = classifyDay({
        day,
        shift: shiftRules.get(day.shiftId),
        rules,
      });
      return total + classification.overtimeMinutes;
    }, 0);

    const registeredHours = (
      (requestsResult.data ?? []) as Array<{
        id: string;
        from_time: string | null;
        to_time: string | null;
      }>
    )
      .filter((row) => row.id !== excludeRequestId)
      .reduce(
        (total, row) =>
          total +
          requestedOvertimeHours(
            row.from_time?.slice(0, 5) ?? null,
            row.to_time?.slice(0, 5) ?? null,
          ),
        0,
      );

    const actualHours = Math.round((actualMinutes / 60) * 100) / 100;

    return NextResponse.json(
      overtimeUsageSchema.parse({
        employeeId: queryParams.employeeId,
        month: queryParams.month,
        actualHours,
        registeredHours: Math.round(registeredHours * 100) / 100,
        usedHours: Math.round((actualHours + registeredHours) * 100) / 100,
        capHours: settings.overtimeCapHoursPerMonth,
      }),
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
        { error: "Không thể tính giờ tăng ca đã dùng." },
        { status: 404 },
      );
    }
    console.error("Lỗi không xác định ở GET /api/requests/overtime-usage:", cause);
    return NextResponse.json(
      { error: "Không thể tính giờ tăng ca đã dùng." },
      { status: 500 },
    );
  }
}
