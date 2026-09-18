"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  payRateInputSchema,
  payRateRowSchema,
  rateVoidInputSchema,
} from "@/lib/validation/api/pay-rates";
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
  "id, company_id, employee_id, unit, amount, effective_from, created_at, created_by, voided_at, voided_by, void_reason";

/** Ma loi Postgres cho vi pham rang buoc unique. */
const UNIQUE_VIOLATION = "23505";

/**
 * Tra ve DONG vua chen, khong kem hai truong ten (`createdByName`,
 * `voidedByName`): ten la du lieu cua ho so nhan vien, do `GET /api/pay-rates`
 * ghep vao khi doc lai. Khai xong man hinh doc lai ca lich su, nen khong co
 * gia tri nao bi thieu tren man hinh.
 */
export async function createPayRate(
  input: PayRateInput,
): Promise<Omit<PayRate, "createdByName" | "voidedByName">> {
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

/**
 * HUY MOT DONG KHAI NHAM (D-57). Khong phai mot phep sua, va khong phai mot
 * phep xoa: dong o lai trong lich su kem ly do, nhung moi duong doc muc luong
 * deu bo qua no ke tu day.
 *
 * `reason` BAT BUOC, cung lap luan voi `reopenPayroll` (D-45): huy mot con so
 * tien ma khong noi vi sao la xoa mot su kien trong im lang.
 *
 * KHONG co phep kiem "dong nay da di vao ky da chot chua" — va do khong phai
 * su so sot. Ban chot chep so tien vao chinh no (`payroll_lines`), nen huy o
 * day KHONG THE lam no doi; va CHAN huy se khoa luon duong sua cho cac ky
 * dang mo, vi muc luong mang theo ve sau. Man hinh co nhiem vu noi ro dieu do
 * truoc khi nguoi dung bam — xem muc (2) cua migration 0038.
 *
 * MOT CHIEU: khong co `unvoidPayRate()`. Huy nham thi khai lai nhu mot phien
 * ban moi — trigger cua 0038 tu choi moi phep go dau huy.
 */
export async function voidPayRate(id: string, reason: string): Promise<void> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const input = rateVoidInputSchema.parse({ id, reason });

  const supabase = await createServerSupabase();

  // Doc nguyen dong TRUOC (D-18), va day cung la phep kiem "dong nay co thuoc
  // doanh nghiep cua phien khong" (D-12b).
  const { data: before } = await supabase
    .from("employee_pay_rates")
    .select(PAY_RATE_COLUMNS)
    .eq("company_id", companyId)
    .eq("id", input.id)
    .maybeSingle();

  if (!before) {
    throw new Error("Không tìm thấy dòng mức lương này.");
  }
  if ((before as { voided_at: string | null }).voided_at !== null) {
    throw new Error("Dòng này đã được huỷ trước đó.");
  }

  // Dau thoi gian tu DONG HO MAY CHU (D-19), khong tu dong ho cua tien trinh
  // ung dung. `insert` lay duoc `default now()`; mot `update` thi khong, nen
  // phai hoi thang.
  const { data: serverNow, error: nowError } = await supabase.rpc("tf_server_now");
  if (nowError || !serverNow) {
    throw new Error("Không đọc được thời gian máy chủ.");
  }

  const { data: after, error } = await supabase
    .from("employee_pay_rates")
    .update({
      voided_at: serverNow as string,
      voided_by: userId,
      void_reason: input.reason,
    })
    .eq("company_id", companyId)
    .eq("id", input.id)
    .select(PAY_RATE_COLUMNS)
    .single();

  if (error || !after) {
    throw new Error("Không thể huỷ dòng mức lương này.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "employee_pay_rates",
    entityId: input.id,
    before,
    after,
    reason: input.reason,
  });
}
