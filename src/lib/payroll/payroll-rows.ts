import { loadMonthContext, summarizeMonth } from "@/lib/attendance/month-context";
import { addDays } from "@/lib/format";
import { computePayrollLine } from "@/lib/payroll/compute";
import { loadPayrollContext } from "@/lib/payroll/payroll-context";
import { createServerSupabase } from "@/lib/supabase/server";
import { attendanceRecordSchema } from "@/lib/validation/api/attendance";
import type {
  AttendanceRecord,
  EmployeeStatus,
  PayrollPrepRow,
  WorkMode,
} from "@/lib/types/domain";

/**
 * Dung TOAN BO cac dong cua bang luong mot thang, TINH LUC TRUY VAN.
 *
 * ======================================================================
 * VI SAO HAM NAY TON TAI (thay vi nam trong Route Handler nhu truoc 05-2-05)
 * ======================================================================
 *
 * Tu 05-2-05 co HAI noi can chinh xac cung mot ket qua:
 *   - `GET /api/payroll/summary` khi ky CHUA chot luong;
 *   - `closePayroll()` khi ghi ban chot.
 *
 * Neu hai noi tu dung phep tinh cua rieng minh, con so duoc CHOT co the khac
 * con so nguoi dung vua nhin thay truoc khi bam — va do la loai sai lech khong
 * ai phat hien ra, vi ca hai deu trong hop ly. Mot ham dung chung lam dieu do
 * thanh khong the xay ra.
 *
 * Module SERVER-ONLY: goi `createServerSupabase()` (doc `next/headers`).
 */

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
  department_id: string | null;
  position: string;
  departments: RawDepartmentJoin | RawDepartmentJoin[] | null;
}

function firstOrSelf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Ai co mat trong bang luong cua mot thang.
 *
 * Nguoi DA NGHI VIEC van phai co mat NEU ho co ban ghi trong thang do — nghi
 * viec giua thang khong xoa di nhung ngay ho da lam, va bo ho khoi bang la mot
 * cach im lang de mot nguoi khong duoc tra cong. Nguoi da nghi viec tu truoc
 * va khong co ban ghi nao thi khong hien.
 */
function shouldInclude(status: EmployeeStatus, hasRecords: boolean): boolean {
  return status !== "terminated" || hasRecords;
}

export interface PayrollRowsResult {
  workMode: WorkMode;
  /** Trang thai KY CONG (`periods.status`); `null` khi ky chua ton tai. */
  periodStatus: "open" | "closed" | null;
  rows: PayrollPrepRow[];
}

export async function buildPayrollRows({
  companyId,
  month,
}: {
  companyId: string;
  /** "YYYY-MM" */
  month: string;
}): Promise<PayrollRowsResult> {
  const supabase = await createServerSupabase();
  const context = await loadMonthContext({ companyId, month });

  // Ngay CUOI CUNG cua ky. `context.end` la ngay dau thang KE TIEP (bien tren
  // khong bao gom), nen lui mot ngay. Muc luong duoc tra tai moc nay — xem
  // khoi comment cua `payroll-context.ts` ve he qua cua lua chon do.
  const periodEnd = addDays(context.end, -1);
  const payrollContext = await loadPayrollContext({ companyId, periodEnd });

  const [employeeResult, attendanceResult, periodResult] = await Promise.all([
    // Goi TEN KHOA NGOAI tuong minh: giua `employees` va `departments` co HAI
    // quan he (`employees.department_id` va `departments.manager_id`) nen
    // PostgREST khong tu suy dien duoc — bo qua se lam ca truy van hong va ten
    // phong ban ve `null` hang loat (loi da gap o 05-06).
    //
    // `department_id` va `position` khong hien ra bang, nhung phep giai PHAM VI
    // cua khoan phu cap can ca hai (`scope.ts`).
    supabase
      .from("employees")
      .select(
        "id, code, full_name, status, department_id, position, departments!employees_department_id_fkey(name)",
      )
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
    throw new Error("Không thể tải bảng lương.");
  }

  // Gom ban ghi theo NHAN VIEN truoc khi tong hop: `groupAttendanceByDay()` gop
  // theo NGAY, nen dua ca tap nhieu nguoi vao se tron cac luot cua ho vao cung
  // mot ngay va ra mot con so vo nghia.
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

      // PHEP TINH TIEN — mot loi goi duy nhat cua ca du an cho nhanh tinh-luc-
      // truy-van. `computePayrollLine()` KHONG tinh lai gio tang ca (D-31): no
      // nhan `convertedOvertimeHours` voi don gia gio.
      //
      // Mot dong thieu du kien thi thieu MOT MINH NO — ham tra `null` cho dong
      // do va cac dong khac van ra so.
      const payRate = payrollContext.payRateByEmployee.get(employee.id) ?? null;
      // Muc tang ca RIENG cua nguoi nay (0026); thieu = an theo he so doanh nghiep.
      const overtimeRate =
        payrollContext.overtimeRateByEmployee.get(employee.id) ?? null;

      const money = computePayrollLine({
        summary: {
          creditedDays: summary.creditedDays ?? null,
          regularMinutes: summary.regularMinutes ?? null,
          hourDeltaMinutes: summary.hourDeltaMinutes ?? 0,
          convertedOvertimeHours: summary.convertedOvertimeHours ?? null,
          overtimeMinutes: summary.overtimeMinutes ?? 0,
          missingMultiplierKeys: summary.missingMultiplierKeys ?? [],
          missingWorkModeInputs: summary.missingWorkModeInputs ?? [],
          lateCount: summary.lateCount,
        },
        payRate,
        overtimeRate,
        workMode: context.rules.workMode,
        standardDaysPerMonth: context.rules.standardDaysPerMonth,
        standardHoursPerDay: context.rules.standardHoursPerDay,
        adjustments: payrollContext.adjustments,
        employee: {
          id: employee.id,
          departmentId: employee.department_id,
          position: employee.position,
        },
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
        // Cot "Gio quy doi" luon la con so CUA TANG CONG (Phase 4), de bang
        // luong va man hinh cham cong khong bao gio noi hai con so khac nhau —
        // mot bai test doi chieu dung hai duong do. Nguoi co muc tang ca rieng
        // duoc giai thich bang `overtimeRateValueType`/`overtimeRateValue` o
        // duoi, KHONG bang cach viet lai con so nay.
        convertedOvertimeHours: summary.convertedOvertimeHours ?? null,
        missingMultiplierKeys: summary.missingMultiplierKeys ?? [],
        // D-36/D-39: `creditedDays` co the la so thap phan va co the la `null`
        // (thieu mau so). `?? null` o day KHONG phai mot gia tri du phong —
        // `summarizeMonth()` luon dat truong nay; day chi la phep thu hep kieu
        // tu `?:` cua `MonthlySummary`.
        creditedDays: summary.creditedDays ?? null,
        regularMinutes: summary.regularMinutes ?? null,
        hourDeltaMinutes: summary.hourDeltaMinutes ?? 0,
        missingWorkModeInputs: summary.missingWorkModeInputs ?? [],
        // Muc luong DA AP — ban chot (D-42) chep lai truong nay.
        payUnit: payRate?.unit ?? null,
        payAmount: payRate?.amount ?? null,
        // Ban chot (D-42) chep lai CA muc tang ca rieng — khong co no thi khong
        // ai giai thich duoc con so tang ca cua ky da chot.
        overtimeRateValueType: overtimeRate?.valueType ?? null,
        overtimeRateValue: overtimeRate?.value ?? null,
        ...money,
      };
    });

  return {
    workMode: context.rules.workMode,
    periodStatus:
      (periodResult.data as { status: "open" | "closed" } | null)?.status ?? null,
    rows,
  };
}

/** Hai mau so quy doi da duoc dung cho ky nay — can de ghi vao ban chot (D-42). */
export async function loadPayrollDenominators({
  companyId,
  month,
}: {
  companyId: string;
  month: string;
}): Promise<{
  workMode: WorkMode;
  standardHoursPerDay: number | null;
  standardDaysPerMonth: number | null;
}> {
  const context = await loadMonthContext({ companyId, month });
  return {
    workMode: context.rules.workMode,
    standardHoursPerDay: context.rules.standardHoursPerDay,
    standardDaysPerMonth: context.rules.standardDaysPerMonth,
  };
}
