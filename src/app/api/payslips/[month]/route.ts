import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { assertCanViewOwnPayslip } from "@/lib/payroll/payslip-access";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  payslipMonthParamSchema,
  payslipSchema,
} from "@/lib/validation/api/payslips";

/**
 * Chi tiet phieu luong cua MOT ky, cua CHINH nguoi dang nhap (PAY-05).
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`.
 *
 * `month` la tham so duong dan, KHONG phai dinh danh nguoi — D-12b cam nhan
 * dinh danh doanh nghiep tu client, va o day ca `companyId` lan `employeeId`
 * deu den tu phien. Thang chi chon MOT trong nhung ky ma nguoi goi von da co
 * quyen doc; no khong mo rong pham vi.
 *
 * Tra `null` voi ma 200 khi ky do khong co phieu — khong phai 404. Ky chua
 * chot luong, ky truoc khi nguoi nay vao lam, va ky khong ton tai deu phai
 * cho ra CUNG MOT cau tra loi: neu ba truong hop phan biet duoc voi nhau thi
 * co the do lich su chot luong cua doanh nghiep bang cach thu tung thang.
 */
export const dynamic = "force-dynamic";

const LINE_COLUMNS =
  "id, employee_code, employee_name, department_name, pay_unit, pay_amount, " +
  "worked_days, total_minutes, leave_days, late_count, overtime_minutes, " +
  "converted_overtime_hours, base_pay, overtime_pay, hour_adjustment, " +
  "allowance_total, deduction_total, net_pay";

interface RawLine {
  id: string;
  employee_code: string;
  employee_name: string;
  department_name: string | null;
  pay_unit: "month" | "day" | "hour";
  pay_amount: string | number;
  worked_days: number;
  total_minutes: number;
  leave_days: number;
  late_count: number;
  overtime_minutes: number;
  converted_overtime_hours: string | number;
  base_pay: string | number;
  overtime_pay: string | number;
  hour_adjustment: string | number;
  allowance_total: string | number;
  deduction_total: string | number;
  net_pay: string | number;
}

interface RawItem {
  adjustment_id: string | null;
  kind: "allowance" | "deduction";
  name: string;
  amount: string | number;
  multiplier: string | number;
}

function toItem(item: RawItem) {
  return {
    // `adjustment_id` co the `null` (khoan da bi xoa sau khi chot) — dung ten
    // lam khoa hien thi khi ay. Ban chot van doc duoc, va do la muc dich.
    adjustmentId: item.adjustment_id ?? item.name,
    name: item.name,
    amount: Number(item.amount),
    multiplier: Number(item.multiplier),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ month: string }> },
): Promise<NextResponse> {
  try {
    const { month: rawMonth } = await params;
    const parsedMonth = payslipMonthParamSchema.safeParse(rawMonth);
    if (!parsedMonth.success) {
      return NextResponse.json(
        { error: parsedMonth.error.issues[0]?.message ?? "Tháng không hợp lệ." },
        { status: 400 },
      );
    }
    const month = parsedMonth.data;

    const { companyId, employeeId } = await getSessionContext();
    if (!employeeId) {
      return NextResponse.json(null);
    }

    await assertCanViewOwnPayslip(employeeId, companyId);

    const supabase = await createServerSupabase();

    const { data: run, error: runError } = await supabase
      .from("payroll_runs")
      .select("id, closed_at")
      .eq("company_id", companyId)
      .eq("period_start", `${month}-01`)
      .maybeSingle();

    if (runError) {
      console.error("Không thể tải bản chốt lương:", runError.message);
      return NextResponse.json(
        { error: "Không thể tải phiếu lương." },
        { status: 500 },
      );
    }
    if (!run) return NextResponse.json(null);

    const runRow = run as { id: string; closed_at: string };

    // Pham vi CO DINH theo phien — khong tham so nao doi duoc `employee_id`.
    const { data: line, error: lineError } = await supabase
      .from("payroll_lines")
      .select(LINE_COLUMNS)
      .eq("company_id", companyId)
      .eq("run_id", runRow.id)
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (lineError) {
      console.error("Không thể tải dòng lương:", lineError.message);
      return NextResponse.json(
        { error: "Không thể tải phiếu lương." },
        { status: 500 },
      );
    }
    // Ky da chot nhung nguoi nay khong co dong nao (vao lam sau ky do).
    if (!line) return NextResponse.json(null);

    const lineRow = line as unknown as RawLine;

    // Loc theo `line_id` — KHONG keo ca cong ty ve roi loc trong JS. Ban chot
    // lon dan theo tung ky, va mot truy van "lay het roi loc" se nang dan ma
    // khong ai thay cho den luc no cham.
    const { data: itemData, error: itemError } = await supabase
      .from("payroll_line_items")
      .select("adjustment_id, kind, name, amount, multiplier")
      .eq("company_id", companyId)
      .eq("line_id", lineRow.id);

    if (itemError) {
      console.error("Không thể tải các khoản của phiếu lương:", itemError.message);
      return NextResponse.json(
        { error: "Không thể tải phiếu lương." },
        { status: 500 },
      );
    }

    const items = (itemData ?? []) as unknown as RawItem[];

    return NextResponse.json(
      payslipSchema.parse({
        month,
        closedAt: runRow.closed_at,
        employeeCode: lineRow.employee_code,
        employeeName: lineRow.employee_name,
        departmentName: lineRow.department_name,
        payUnit: lineRow.pay_unit,
        payAmount: Number(lineRow.pay_amount),
        workedDays: lineRow.worked_days,
        totalMinutes: lineRow.total_minutes,
        leaveDays: lineRow.leave_days,
        lateCount: lineRow.late_count,
        overtimeMinutes: lineRow.overtime_minutes,
        convertedOvertimeHours: Number(lineRow.converted_overtime_hours),
        basePay: Number(lineRow.base_pay),
        overtimePay: Number(lineRow.overtime_pay),
        hourAdjustment: Number(lineRow.hour_adjustment),
        allowanceItems: items.filter((i) => i.kind === "allowance").map(toItem),
        deductionItems: items.filter((i) => i.kind === "deduction").map(toItem),
        allowanceTotal: Number(lineRow.allowance_total),
        deductionTotal: Number(lineRow.deduction_total),
        netPay: Number(lineRow.net_pay),
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
      return NextResponse.json(null);
    }
    console.error("Lỗi không xác định ở GET /api/payslips/[month]:", cause);
    return NextResponse.json(
      { error: "Không thể tải phiếu lương." },
      { status: 500 },
    );
  }
}
