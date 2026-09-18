"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  employeeOvertimeRateInputSchema,
  employeeOvertimeRateRowSchema,
} from "@/lib/validation/api/overtime-rates";
import { rateVoidInputSchema } from "@/lib/validation/api/pay-rates";
import type {
  EmployeeOvertimeRate,
  EmployeeOvertimeRateInput,
} from "@/lib/types/domain";

/**
 * Duong GHI DUY NHAT cua `employee_overtime_rates`, va no CHI CHEN.
 *
 * Bang nay APPEND-ONLY (migration 0026) vi cung mot ly do voi
 * `employee_pay_rates`: sua de mot dong cu lam tien tang ca DA TRA cua ky da
 * qua tinh lai ra mot con so khac. Doi muc nghia la khai MOT PHIEN BAN MOI voi
 * `effective_from`.
 *
 * Ham nay KHONG tinh mot con so tien nao — day la cho de KHAI; phep tinh nam o
 * `src/lib/payroll/compute.ts`.
 */

const OVERTIME_RATE_COLUMNS =
  "id, company_id, employee_id, value_type, value, effective_from, created_at, created_by, voided_at, voided_by, void_reason";

/** Ma loi Postgres cho vi pham rang buoc unique. */
const UNIQUE_VIOLATION = "23505";

/** Khong kem hai truong ten — cung quy uoc voi `createPayRate`. */
export async function createEmployeeOvertimeRate(
  input: EmployeeOvertimeRateInput,
): Promise<Omit<EmployeeOvertimeRate, "createdByName" | "voidedByName">> {
  const { companyId, userId, role } = await getSessionContext();
  // D-44: `owner` VA `admin` — khong siet rieng ve `owner`, de khong them mot
  // chieu phan quyen thu hai chi cho mot man hinh (AUTH-03 da ve xong ranh
  // gioi khu quan tri).
  requireRole(role, ["owner", "admin"]);

  // Gia tri <= 0 (va bien tren cua tung kieu) bi chan O DAY, TRUOC khi cham
  // database: rang buoc CHECK cua bang la lop bao dam, con lop nay la lop tra
  // ve mot cau tieng Viet doc duoc.
  const writeRow = employeeOvertimeRateInputSchema.parse(input);

  const supabase = await createServerSupabase();

  // Doi chieu nhan vien theo `company_id` cua PHIEN truoc khi ghi (T-05-2-01-02).
  // Mot `employeeId` cua doanh nghiep khac khong khop dieu kien nay -> "khong
  // tim thay", va KHONG dong nao duoc ghi. Khong tra 403 o day: mot thong diep
  // phan biet duoc "id nay ton tai o cho khac" voi "id nay khong ton tai" la
  // mot ro ri danh sach nhan vien cua doanh nghiep ban.
  const { data: employeeRow, error: employeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", writeRow.employee_id)
    .maybeSingle();

  if (employeeError) {
    throw new Error("Không thể kiểm tra nhân viên.");
  }
  if (!employeeRow) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const { data: inserted, error } = await supabase
    .from("employee_overtime_rates")
    .insert({
      company_id: companyId,
      ...writeRow,
      // `created_at` KHONG duoc gui tu day — DEFAULT now() cua database dat no
      // (D-19). Mot dau thoi gian tu tang ung dung la mo duong cho dong ho
      // client di vao du lieu.
      created_by: userId,
    })
    .select(OVERTIME_RATE_COLUMNS)
    .single();

  if (error || !inserted) {
    if (error?.code === UNIQUE_VIOLATION) {
      throw new Error(
        `Nhân viên này đã có một mức tăng ca bắt đầu hiệu lực từ ${writeRow.effective_from}. Hãy chọn một ngày hiệu lực khác.`,
      );
    }
    throw new Error("Không thể khai mức tăng ca.");
  }

  const overtimeRate = employeeOvertimeRateRowSchema.parse(inserted);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "employee_overtime_rates",
    entityId: overtimeRate.id,
    before: null,
    after: inserted,
    reason: null,
  });

  return overtimeRate;
}

/**
 * HUY MOT DONG KHAI NHAM cua muc tang ca rieng (D-57) — cung khuon, cung ly
 * do voi `voidPayRate()`; xem khoi comment o do.
 *
 * Huy dong cuoi cung con hieu luc dua nguoi do ve "khong co muc rieng", tuc la
 * an theo he so tang ca cua doanh nghiep — KHONG phai "tang ca bang 0".
 */
export async function voidEmployeeOvertimeRate(
  id: string,
  reason: string,
): Promise<void> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const input = rateVoidInputSchema.parse({ id, reason });

  const supabase = await createServerSupabase();

  const { data: before } = await supabase
    .from("employee_overtime_rates")
    .select(OVERTIME_RATE_COLUMNS)
    .eq("company_id", companyId)
    .eq("id", input.id)
    .maybeSingle();

  if (!before) {
    throw new Error("Không tìm thấy dòng mức tăng ca này.");
  }
  if ((before as { voided_at: string | null }).voided_at !== null) {
    throw new Error("Dòng này đã được huỷ trước đó.");
  }

  const { data: serverNow, error: nowError } = await supabase.rpc("tf_server_now");
  if (nowError || !serverNow) {
    throw new Error("Không đọc được thời gian máy chủ.");
  }

  const { data: after, error } = await supabase
    .from("employee_overtime_rates")
    .update({
      voided_at: serverNow as string,
      voided_by: userId,
      void_reason: input.reason,
    })
    .eq("company_id", companyId)
    .eq("id", input.id)
    .select(OVERTIME_RATE_COLUMNS)
    .single();

  if (error || !after) {
    throw new Error("Không thể huỷ dòng mức tăng ca này.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "employee_overtime_rates",
    entityId: input.id,
    before,
    after,
    reason: input.reason,
  });
}
