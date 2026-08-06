import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  requireRole,
} from "@/lib/auth/session-context";
import { buildPayrollRows } from "@/lib/payroll/payroll-rows";
import { createServerSupabase } from "@/lib/supabase/server";
import { payrollPrepSchema, payrollQuerySchema } from "@/lib/validation/api/payroll";
import type { PayrollPrepRow } from "@/lib/types/domain";

/**
 * Bang luong cua mot thang: mot dong cho moi nhan vien. Khuon 02-04 (D-12c):
 * chi xuat `dynamic` va `GET`. Duong GHI la hai Server Action
 * `closePayroll`/`reopenPayroll` (`src/lib/data/mutations/payroll.ts`).
 *
 * ======================================================================
 * HAI NGUON, MOT HINH DANG PHAN HOI
 * ======================================================================
 *
 *   Ky DA CHOT LUONG  -> doc tu BAN CHOT (`payroll_runs`), khong tinh lai gi.
 *   Ky CHUA CHOT       -> tinh luc truy van qua `buildPayrollRows()`.
 *
 * Nhanh dau la toan bo ly do ban chot ton tai (D-42): mot khi da tra tien, con
 * so la MOT SU KIEN DA XAY RA, khong phai mot phep tinh co the ra ket qua khac
 * vao thang sau. Tinh lai o day se lam bang luong thang 07 doi theo cau hinh
 * cua thang 09 — va cau hoi "thang 07 da tra bao nhieu" mat cau tra loi.
 *
 * HAI NHANH TRA CUNG MOT HINH DANG, co chu dich: neu chung tra hai hinh dang
 * khac nhau thi man hinh se moc hai duong render, va mot trong hai se muc dan
 * vi it duoc dung hon.
 *
 * Chi `owner`/`admin` doc: bang nay gop so lieu luong cua toan bo nhan vien
 * trong mot phan hoi.
 */
export const dynamic = "force-dynamic";

const RUN_COLUMNS =
  "id, period_start, work_mode, standard_hours_per_day, standard_days_per_month, closed_at, closed_by";
const LINE_COLUMNS =
  "id, employee_id, employee_code, employee_name, department_name, pay_unit, pay_amount, credited_days, regular_minutes, hour_delta_minutes, converted_overtime_hours, late_count, worked_days, total_minutes, leave_days, overtime_minutes, overtime_night_minutes, base_pay, overtime_pay, hour_adjustment, allowance_total, deduction_total, net_pay";
const ITEM_COLUMNS = "line_id, adjustment_id, kind, name, amount, multiplier";

interface RawRun {
  id: string;
  work_mode: "daily_hours" | "shift" | "shift_hourly";
  closed_at: string;
  closed_by: string | null;
}

interface RawLine {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_name: string | null;
  pay_unit: "month" | "day" | "hour";
  pay_amount: string | number;
  credited_days: string | number;
  regular_minutes: number;
  hour_delta_minutes: number;
  converted_overtime_hours: string | number;
  late_count: number;
  worked_days: number;
  total_minutes: number;
  leave_days: number;
  overtime_minutes: number;
  overtime_night_minutes: number;
  base_pay: string | number;
  overtime_pay: string | number;
  hour_adjustment: string | number;
  allowance_total: string | number;
  deduction_total: string | number;
  net_pay: string | number;
}

interface RawItem {
  line_id: string;
  adjustment_id: string | null;
  kind: "allowance" | "deduction";
  name: string;
  amount: string | number;
  multiplier: string | number;
}

function toItem(item: RawItem) {
  return {
    // `adjustment_id` co the la `null` (khoan da bi xoa sau khi chot) — dung
    // ten lam khoa hien thi khi ay. Ban chot van doc duoc, va do la muc dich.
    adjustmentId: item.adjustment_id ?? item.name,
    name: item.name,
    amount: Number(item.amount),
    multiplier: Number(item.multiplier),
  };
}

/**
 * Dung lai hinh dang `PayrollPrepRow` tu BAN CHOT.
 *
 * KHONG MOT PHEP TINH NAO chay o day — moi con so den tu chinh ban chot, ke ca
 * cac cot so lieu cong chi de hien thi. Suy lai bat ky con so nao o day se lam
 * no doi theo du lieu cua HOM NAY trong khi cac cot tien thi khong, va mot
 * bang tu mau thuan voi chinh no la thu te hon ca mot bang sai.
 */
function rowFromSnapshot(line: RawLine, items: RawItem[]): PayrollPrepRow {
  const lineItems = items.filter((item) => item.line_id === line.id);

  return {
    employeeId: line.employee_id,
    employeeCode: line.employee_code,
    employeeName: line.employee_name,
    departmentName: line.department_name,
    workedDays: line.worked_days,
    totalMinutes: line.total_minutes,
    lateCount: line.late_count,
    leaveDays: line.leave_days,
    overtimeMinutes: line.overtime_minutes,
    overtimeNightMinutes: line.overtime_night_minutes,
    convertedOvertimeHours: Number(line.converted_overtime_hours),
    // Mot ky chi chot duoc khi KHONG dong nao thieu du kien (xem
    // `closePayroll`), nen hai mang nay luon rong o nhanh nay — do la mot BAT
    // BIEN duoc cuong che o duong ghi, khong phai mot gia dinh.
    missingMultiplierKeys: [],
    creditedDays: Number(line.credited_days),
    regularMinutes: line.regular_minutes,
    hourDeltaMinutes: line.hour_delta_minutes,
    missingWorkModeInputs: [],
    payUnit: line.pay_unit,
    payAmount: Number(line.pay_amount),
    basePay: Number(line.base_pay),
    overtimePay: Number(line.overtime_pay),
    hourAdjustment: Number(line.hour_adjustment),
    allowanceItems: lineItems
      .filter((item) => item.kind === "allowance")
      .map(toItem),
    deductionItems: lineItems
      .filter((item) => item.kind === "deduction")
      .map(toItem),
    allowanceTotal: Number(line.allowance_total),
    deductionTotal: Number(line.deduction_total),
    netPay: Number(line.net_pay),
    missing: [],
  };
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
    const periodStart = `${month}-01`;

    const supabase = await createServerSupabase();

    const [runResult, periodResult] = await Promise.all([
      supabase
        .from("payroll_runs")
        .select(RUN_COLUMNS)
        .eq("company_id", companyId)
        .eq("period_start", periodStart)
        .maybeSingle(),
      supabase
        .from("periods")
        .select("status")
        .eq("company_id", companyId)
        .eq("start_date", periodStart)
        .maybeSingle(),
    ]);

    const periodStatus =
      (periodResult.data as { status: "open" | "closed" } | null)?.status ?? null;
    const run = runResult.data as RawRun | null;

    /* ---------------------------------------------------------------- */
    /* NHANH 1: ky DA CHOT LUONG -> doc tu ban chot, KHONG tinh lai       */
    /* ---------------------------------------------------------------- */
    if (run) {
      const [lineResult, itemResult] = await Promise.all([
        supabase
          .from("payroll_lines")
          .select(LINE_COLUMNS)
          .eq("company_id", companyId)
          .eq("run_id", run.id)
          .order("employee_code", { ascending: true }),
        supabase
          .from("payroll_line_items")
          .select(ITEM_COLUMNS)
          .eq("company_id", companyId),
      ]);

      if (lineResult.error) {
        throw new Error("Không thể tải bảng lương đã chốt.");
      }

      const lines = (lineResult.data ?? []) as unknown as RawLine[];
      const items = (itemResult.data ?? []) as unknown as RawItem[];
      const rows = lines.map((line) => rowFromSnapshot(line, items));

      return NextResponse.json(
        payrollPrepSchema.parse({
          month,
          // Che do da AP LUC CHOT, khong phai che do hom nay — do la mot phan
          // cua "ban chot tu chua" (D-42).
          workMode: run.work_mode,
          periodStatus,
          payrollStatus: "closed",
          payrollClosedAt: run.closed_at,
          payrollClosedBy: run.closed_by,
          rows,
        }),
      );
    }

    /* ---------------------------------------------------------------- */
    /* NHANH 2: ky CHUA CHOT LUONG -> tinh luc truy van                   */
    /* ---------------------------------------------------------------- */
    const live = await buildPayrollRows({ companyId, month });

    return NextResponse.json(
      payrollPrepSchema.parse({
        month,
        workMode: live.workMode,
        periodStatus: live.periodStatus,
        payrollStatus: "open",
        payrollClosedAt: null,
        payrollClosedBy: null,
        rows: live.rows,
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
      { error: "Không thể tải bảng lương." },
      { status: 500 },
    );
  }
}
