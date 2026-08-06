"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import { payRateInputSchema, payRateRowSchema } from "@/lib/validation/api/pay-rates";
import type { PayRate, PayRateInput } from "@/lib/types/domain";

/**
 * Duong GHI DUY NHAT cua `employee_pay_rates`, va no CHI CHEN.
 *
 * Bang nay la APPEND-ONLY (D-37a): sua mot muc luong nghia la khai MOT PHIEN
 * BAN MOI voi `effective_from`, khong bao gio UPDATE hay DELETE dong cu. Do la
 * co che duy nhat lam cho loi hua "bang luong cua ky da tra khong doi sau lung
 * ai" thanh su that kiem chung duoc.
 *
 * Neu mot ngay nao do ai do quen quy uoc nay va viet `.update()` o day, trigger
 * `employee_pay_rates_append_only` (migration 0022) se chan lai o tang
 * database — do la ly do trigger ton tai.
 *
 * PLAN NAY KHONG TINH MOT CON SO TIEN NAO. Day la cho de KHAI; phep tinh nam o
 * 05-2-04.
 */

const PAY_RATE_COLUMNS =
  "id, company_id, employee_id, unit, amount, effective_from, created_at, created_by";

/** Ma loi Postgres cho vi pham rang buoc unique. */
const UNIQUE_VIOLATION = "23505";

export async function createPayRate(input: PayRateInput): Promise<PayRate> {
  const { companyId, userId, role } = await getSessionContext();
  // D-44: `owner` VA `admin` — khong siet rieng ve `owner`, de khong them mot
  // chieu phan quyen thu hai chi cho mot man hinh (AUTH-03 da ve xong ranh
  // gioi khu quan tri).
  requireRole(role, ["owner", "admin"]);

  // `amount <= 0` bi chan O DAY, TRUOC khi cham database: rang buoc CHECK cua
  // bang la lop bao dam, con lop nay la lop tra ve mot cau tieng Viet doc duoc.
  const writeRow = payRateInputSchema.parse(input);

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
    .from("employee_pay_rates")
    .insert({
      company_id: companyId,
      ...writeRow,
      // `created_at` KHONG duoc gui tu day — DEFAULT now() cua database dat no
      // (D-19). Mot dau thoi gian tu tang ung dung la mo duong cho dong ho
      // client di vao du lieu.
      created_by: userId,
    })
    .select(PAY_RATE_COLUMNS)
    .single();

  if (error || !inserted) {
    if (error?.code === UNIQUE_VIOLATION) {
      throw new Error(
        `Nhân viên này đã có một mức lương bắt đầu hiệu lực từ ${writeRow.effective_from}. Hãy chọn một ngày hiệu lực khác.`,
      );
    }
    throw new Error("Không thể khai mức lương.");
  }

  const payRate = payRateRowSchema.parse(inserted);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "employee_pay_rates",
    entityId: payRate.id,
    before: null,
    after: inserted,
    reason: null,
  });

  return payRate;
}
