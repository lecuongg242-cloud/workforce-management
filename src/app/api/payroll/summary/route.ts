import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  requireRole,
} from "@/lib/auth/session-context";
import { loadMonthContext, summarizeMonth } from "@/lib/attendance/month-context";
import { createServerSupabase } from "@/lib/supabase/server";
import { attendanceRecordSchema } from "@/lib/validation/api/attendance";
import { payrollPrepSchema, payrollQuerySchema } from "@/lib/validation/api/payroll";
import type {
  AttendanceRecord,
  EmployeeStatus,
  PayrollPrepRow,
} from "@/lib/types/domain";

/**
 * Bang CHUAN BI luong cua mot thang: mot dong cho moi nhan vien dang lam
 * viec. Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`.
 *
 * KHONG CO CON SO TIEN NAO. Xem khoi chu thich cua `PayrollPrepRow`
 * (`domain.ts`): V2 chuan bi du lieu cong, khong tinh luong.
 *
 * MOI CON SO O DAY DEN TU `summarizeMonth()` — cung ham ma
 * `GET /api/attendance/summary` dung cho mot nguoi. Hai man hinh khong the
 * noi hai con so khac nhau ve cung mot thang, va khong cot nao luu san ket
 * qua (cung khuon tinh-luc-truy-van cua Phase 4).
 *
 * NHAN VIEN KHONG CO BAN GHI NAO VAN CO MOT DONG (toan so 0). Bo ho di se
 * lam ke toan tuong danh sach bi thieu nguoi, va do la mot cach im lang de
 * mot nguoi khong duoc tra cong.
 *
 * Chi `owner`/`admin` doc: bang nay gop so lieu cong cua toan bo nhan vien
 * trong mot phan hoi.
 */
export const dynamic = "force-dynamic";

const ATTENDANCE_COLUMNS =
  "id, company_id, employee_id, work_date, shift_id, check_in_at, check_out_at, worked_minutes, late_minutes, early_leave_minutes, status, location, needs_supplement, note";

interface RawDepartmentJoin {
  name: string;
}

interface RawEmployeeRow {
  id: string;
  code: string;
  full_name: string;
  status: EmployeeStatus;
  departments: RawDepartmentJoin | RawDepartmentJoin[] | null;
}

function firstOrSelf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Ai co mat trong bang chuan bi luong cua mot thang.
 *
 * Nguoi DA NGHI VIEC van phai co mat NEU ho co ban ghi trong thang do — nghi
 * viec giua thang khong xoa di nhung ngay ho da lam, va bo ho khoi bang la
 * mot cach im lang de mot nguoi khong duoc tra cong. Nguoi da nghi viec tu
 * truoc va khong co ban ghi nao thi khong hien, vi mot dong toan so 0 cua ho
 * chi lam dai bang.
 */
function shouldInclude(status: EmployeeStatus, hasRecords: boolean): boolean {
  return status !== "terminated" || hasRecords;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId, role } = await getSessionContext();
    requireRole(role, ["owner", "admin"]);

    const url = new URL(request.url);
    const parsed = payrollQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Tham số truy vấn không hợp lệ." },
        { status: 400 },
      );
    }
    const { month } = parsed.data;

    const supabase = await createServerSupabase();
    const context = await loadMonthContext({ companyId, month });

    const [employeeResult, attendanceResult, periodResult] = await Promise.all([
      // Goi TEN KHOA NGOAI tuong minh: giua `employees` va `departments` co
      // HAI quan he (`employees.department_id` va `departments.manager_id`)
      // nen PostgREST khong tu suy dien duoc — bo qua se lam ca truy van hong
      // va ten phong ban ve `null` hang loat (loi da gap o 05-06).
      // KHONG loc `status` o truy van: quy tac "ai co mat trong bang" duoc ap
      // o tang duoi (xem `shouldInclude`) vi no can biet nhan vien do co ban
      // ghi trong thang hay khong.
      supabase
        .from("employees")
        .select("id, code, full_name, status, departments!employees_department_id_fkey(name)")
        .eq("company_id", companyId)
        .order("code", { ascending: true }),
      supabase
        .from("attendance_records")
        .select(ATTENDANCE_COLUMNS)
        .eq("company_id", companyId)
        .gte("work_date", context.start)
        .lt("work_date", context.end),
      supabase
        .from("periods")
        .select("status")
        .eq("company_id", companyId)
        .eq("start_date", context.start)
        .maybeSingle(),
    ]);

    if (employeeResult.error || attendanceResult.error) {
      return NextResponse.json(
        { error: "Không thể tải bảng chuẩn bị lương." },
        { status: 500 },
      );
    }

    // Gom ban ghi theo NHAN VIEN truoc khi tong hop: `groupAttendanceByDay()`
    // gop theo NGAY, nen dua ca tap nhieu nguoi vao se tron cac luot cua ho
    // vao cung mot ngay va ra mot con so vo nghia.
    const recordsByEmployee = new Map<string, AttendanceRecord[]>();
    for (const raw of (attendanceResult.data ?? []) as unknown[]) {
      const record = attendanceRecordSchema.parse(raw);
      const list = recordsByEmployee.get(record.employeeId);
      if (list) list.push(record);
      else recordsByEmployee.set(record.employeeId, [record]);
    }

    const rows: PayrollPrepRow[] = (
      (employeeResult.data ?? []) as unknown as RawEmployeeRow[]
    )
      .filter((employee) =>
        shouldInclude(employee.status, recordsByEmployee.has(employee.id)),
      )
      .map((employee) => {
        const summary = summarizeMonth({
          records: recordsByEmployee.get(employee.id) ?? [],
          context,
          month,
        });
        return {
          employeeId: employee.id,
          employeeCode: employee.code,
          employeeName: employee.full_name,
          departmentName: firstOrSelf(employee.departments)?.name ?? null,
          workedDays: summary.workedDays,
          totalMinutes: summary.totalMinutes,
          lateCount: summary.lateCount,
          leaveDays: summary.leaveDays,
          overtimeMinutes: summary.overtimeMinutes ?? 0,
          overtimeNightMinutes: summary.overtimeNightMinutes ?? 0,
          convertedOvertimeHours: summary.convertedOvertimeHours ?? null,
          missingMultiplierKeys: summary.missingMultiplierKeys ?? [],
        };
      });

    return NextResponse.json(
      payrollPrepSchema.parse({
        month,
        // `null` khi ky chua ton tai — khac `open`, va giao dien noi hai dieu
        // khac nhau cho hai truong hop do.
        periodStatus:
          (periodResult.data as { status: "open" | "closed" } | null)?.status ?? null,
        rows,
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
        { error: "Vui lòng chọn doanh nghiệp bạn muốn truy cập." },
        { status: 400 },
      );
    }
    console.error("Lỗi không xác định ở GET /api/payroll/summary:", cause);
    return NextResponse.json(
      { error: "Không thể tải bảng chuẩn bị lương." },
      { status: 500 },
    );
  }
}
