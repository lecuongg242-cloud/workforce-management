"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import {
  buildPayrollRows,
  loadPayrollDenominators,
} from "@/lib/payroll/payroll-rows";
import { createServerSupabase } from "@/lib/supabase/server";
import { describeMissingReason } from "@/lib/constants";

/**
 * CHOT LUONG va HUY CHOT LUONG mot ky (D-42/D-45, plan 05-2-05).
 *
 * ======================================================================
 * HAI DIEU KIEN TRUOC KHI CHOT, VA VI SAO CHUNG O DAY
 * ======================================================================
 *
 * (1) KY CONG PHAI DA CHOT. So lieu cong con doi duoc (mot yeu cau cho duyet,
 * mot lan cham cong bu) thi con so tien chua dang de dong khung. Chot luong
 * trong khi ky cong con mo la tao ra mot ban chot ma chinh so lieu goc cua no
 * co the doi ngay hom sau — va khi ay ban chot khong con giai thich duoc gi.
 *
 * (2) KHONG DONG NAO THIEU DU KIEN. Mot ban chot co lo la mot ban chot noi
 * doi: no trong nhu da day du. Thong diep tu choi phai noi ro THIEU GI CUA AI,
 * vi "co dong thieu du kien" khong giup nguoi dung lam duoc gi.
 *
 * ======================================================================
 * HUY CHOT LUONG XOA CA BAN CHOT, KHONG SUA TUNG DONG (D-45)
 * ======================================================================
 *
 * Sua le mot dong la mo duong cho mot con so khong ai giai thich duoc. Huy ca
 * ban roi chot lai thi moi con so duoc tinh lai cung mot luc, va co mot dong
 * `audit_log` mang LY DO BAT BUOC.
 *
 * Day la cho khac han ky cong (D-32b: khong co duong mo lai). Ly do nam o khoi
 * comment muc (2) cua migration 0024.
 *
 * GIOI HAN GHI RO: he thong KHONG BIET tien da tra hay chua, nen no khong chan
 * duoc viec huy mot ky da tra.
 */

/** So nguoi duoc neu ten trong thong diep tu choi truoc khi rut gon. */
const MAX_NAMED_IN_ERROR = 3;

function monthToPeriodStart(month: string): string {
  return `${month}-01`;
}

/**
 * Cau "ai thieu gi" cua thong diep tu choi. Neu ten vai nguoi dau roi rut gon:
 * mot danh sach bon muoi ten trong mot toast la mot danh sach khong ai doc.
 */
function describeIncompleteRows(
  rows: Array<{ employeeName: string; missing: string[] }>,
): string {
  const named = rows.slice(0, MAX_NAMED_IN_ERROR).map((row) => {
    const reason =
      row.missing.length > 0
        ? describeMissingReason(row.missing[0])
        : "chưa đủ dữ kiện";
    return `${row.employeeName} (${reason})`;
  });
  const rest = rows.length - named.length;
  return rest > 0
    ? `${named.join(", ")} và ${rest} người khác`
    : named.join(", ");
}

export interface ClosePayrollResult {
  periodStart: string;
  lineCount: number;
  netPayTotal: number;
}

export async function closePayroll(month: string): Promise<ClosePayrollResult> {
  const { companyId, userId, role } = await getSessionContext();
  // D-44: `owner` VA `admin` — khong siet rieng ve `owner`.
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();
  const periodStart = monthToPeriodStart(month);

  // Da chot roi thi tu choi som, truoc khi tinh lai ca bang.
  const { data: existing } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("company_id", companyId)
    .eq("period_start", periodStart)
    .maybeSingle();
  if (existing) {
    throw new Error(
      `Kỳ lương tháng ${month.slice(5)}/${month.slice(0, 4)} đã được chốt trước đó rồi.`,
    );
  }

  // Con so ghi vao ban chot den tu CHINH ham ma man hinh dang dung
  // (`buildPayrollRows`) — khong mot duong tinh thu hai nao.
  const { rows, periodStatus } = await buildPayrollRows({ companyId, month });
  const denominators = await loadPayrollDenominators({ companyId, month });

  // Dieu kien (1).
  if (periodStatus !== "closed") {
    throw new Error(
      `Kỳ công tháng ${month.slice(5)}/${month.slice(0, 4)} chưa được chốt, nên số liệu công còn thay đổi được. Hãy chốt kỳ công ở trang Kỳ công trước.`,
    );
  }

  if (rows.length === 0) {
    throw new Error("Kỳ này chưa có nhân viên nào để chốt lương.");
  }

  // Dieu kien (2).
  const incomplete = rows.filter((row) => row.netPay === null);
  if (incomplete.length > 0) {
    throw new Error(
      `Chưa chốt lương được vì còn ${incomplete.length} dòng chưa đủ dữ kiện: ${describeIncompleteRows(incomplete)}.`,
    );
  }

  const { data: run, error: runError } = await supabase
    .from("payroll_runs")
    .insert({
      company_id: companyId,
      period_start: periodStart,
      // CACH TINH da ap, chep lai — ban chot phai tu chua (D-42).
      work_mode: denominators.workMode,
      standard_hours_per_day: denominators.standardHoursPerDay,
      standard_days_per_month: denominators.standardDaysPerMonth,
      // `closed_at` KHONG duoc gui tu day: DEFAULT now() cua database dat no
      // (D-19). Mot dau thoi gian tu tang ung dung la mo duong cho dong ho
      // client di vao du lieu.
      closed_by: userId,
    })
    .select("id, closed_at")
    .single();

  if (runError || !run) {
    throw new Error("Không thể chốt lương kỳ này.");
  }
  const runId = (run as { id: string }).id;

  const { data: insertedLines, error: lineError } = await supabase
    .from("payroll_lines")
    .insert(
      rows.map((row) => ({
        company_id: companyId,
        run_id: runId,
        employee_id: row.employeeId,
        // ANH CHUP danh tinh — nguoi co the doi ten hoac nghi viec sau khi chot.
        employee_code: row.employeeCode,
        employee_name: row.employeeName,
        department_name: row.departmentName,
        pay_unit: row.payUnit,
        pay_amount: row.payAmount,
        credited_days: row.creditedDays,
        regular_minutes: row.regularMinutes,
        hour_delta_minutes: row.hourDeltaMinutes,
        converted_overtime_hours: row.convertedOvertimeHours,
        late_count: row.lateCount,
        // So lieu cong chi de hien thi — cung duoc chep lai, de mo mot ky da
        // chot cho ra DUNG cai bang ma nguoi chot da nhin thay.
        worked_days: row.workedDays,
        total_minutes: row.totalMinutes,
        leave_days: row.leaveDays,
        overtime_minutes: row.overtimeMinutes,
        overtime_night_minutes: row.overtimeNightMinutes,
        base_pay: row.basePay,
        overtime_pay: row.overtimePay,
        hour_adjustment: row.hourAdjustment,
        allowance_total: row.allowanceTotal,
        deduction_total: row.deductionTotal,
        net_pay: row.netPay,
      })),
    )
    .select("id, employee_id");

  if (lineError || !insertedLines) {
    // Ban chot chi co mot dong `payroll_runs` va chua co dong luong nao — xoa
    // di de khong de lai mot ban chot RONG, thu doc ra thanh "ky nay da chot
    // va khong ai duoc tra gi".
    await supabase.from("payroll_runs").delete().eq("id", runId);
    throw new Error("Không thể ghi các dòng của bảng lương đã chốt.");
  }

  const lineIdByEmployee = new Map(
    (insertedLines as Array<{ id: string; employee_id: string }>).map((line) => [
      line.employee_id,
      line.id,
    ]),
  );

  const items = rows.flatMap((row) => {
    const lineId = lineIdByEmployee.get(row.employeeId);
    if (!lineId) return [];
    return [
      ...row.allowanceItems.map((item) => ({
        company_id: companyId,
        line_id: lineId,
        adjustment_id: item.adjustmentId,
        kind: "allowance" as const,
        // `name` CHEP LAI, khong tham chieu song: khoan co the bi tat hoac doi
        // ten sau khi chot, va ban chot van phai giai thich duoc con so.
        name: item.name,
        amount: item.amount,
        multiplier: item.multiplier,
      })),
      ...row.deductionItems.map((item) => ({
        company_id: companyId,
        line_id: lineId,
        adjustment_id: item.adjustmentId,
        kind: "deduction" as const,
        name: item.name,
        amount: item.amount,
        multiplier: item.multiplier,
      })),
    ];
  });

  if (items.length > 0) {
    const { error: itemError } = await supabase
      .from("payroll_line_items")
      .insert(items);
    if (itemError) {
      await supabase.from("payroll_runs").delete().eq("id", runId);
      throw new Error("Không thể ghi các khoản của bảng lương đã chốt.");
    }
  }

  const netPayTotal = rows.reduce((sum, row) => sum + (row.netPay ?? 0), 0);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "payroll_runs",
    entityId: runId,
    before: null,
    after: {
      period_start: periodStart,
      work_mode: denominators.workMode,
      line_count: rows.length,
      net_pay_total: netPayTotal,
    },
    reason: null,
  });

  return { periodStart, lineCount: rows.length, netPayTotal };
}

/**
 * HUY CHOT LUONG mot ky (D-45). Xoa CA ban chot — cac dong va cac khoan di
 * theo bang `on delete cascade`.
 *
 * `reason` BAT BUOC va khong duoc de trong: huy mot ban tuyen bo tai chinh ma
 * khong noi vi sao la xoa mot su kien trong im lang. Day la khac biet lon nhat
 * so voi ky cong, von khong co duong lui nao ca (D-32b).
 */
export async function reopenPayroll(
  month: string,
  reason: string,
): Promise<void> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const trimmedReason = reason.trim();
  if (trimmedReason.length === 0) {
    throw new Error(
      "Vui lòng nêu lý do huỷ chốt lương — đây là dấu vết duy nhất giải thích vì sao bảng lương đã chốt bị bỏ đi.",
    );
  }

  const supabase = await createServerSupabase();
  const periodStart = monthToPeriodStart(month);

  // Doc nguyen dong TRUOC (D-18) — va cung la phep kiem "ban chot nay co thuoc
  // doanh nghiep cua phien khong".
  const { data: before } = await supabase
    .from("payroll_runs")
    .select("id, period_start, work_mode, closed_at, closed_by")
    .eq("company_id", companyId)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (!before) {
    throw new Error("Kỳ này chưa được chốt lương.");
  }
  const runId = (before as { id: string }).id;

  // Dem lai truoc khi xoa, de dong audit noi duoc quy mo cua thu vua bi bo di.
  const { count: lineCount } = await supabase
    .from("payroll_lines")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);

  const { error } = await supabase
    .from("payroll_runs")
    .delete()
    .eq("company_id", companyId)
    .eq("id", runId);

  if (error) {
    throw new Error("Không thể huỷ chốt lương kỳ này.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "delete",
    entityTable: "payroll_runs",
    entityId: runId,
    before: { ...(before as Record<string, unknown>), line_count: lineCount ?? 0 },
    after: null,
    reason: trimmedReason,
  });
}
