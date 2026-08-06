import { createServerSupabase } from "@/lib/supabase/server";
import { payAdjustmentRowSchema } from "@/lib/validation/api/pay-adjustments";
import type { PayAdjustment, PayRate } from "@/lib/types/domain";

/**
 * Ngu canh de tinh TIEN cho ca mot ky (PAY-01, plan 05-2-04).
 *
 * Doc MOT LAN moi thu ma phep tinh can, roi dung lai cho hang chuc nhan vien —
 * cung khuon `loadMonthContext()` cua 5.1. Doc lai theo tung nguoi la vai chuc
 * round-trip cho mot man hinh, va te hon: hai nguoi co the doc duoc hai phien
 * ban cau hinh khac nhau neu ai do sua giua chung.
 *
 * Module SERVER-ONLY: goi `createServerSupabase()` (doc `next/headers`).
 *
 * ======================================================================
 * MUC LUONG TRA TAI NGAY CUOI KY, KHONG PHAI HOM NAY
 * ======================================================================
 *
 * Bang luong thang 07 phai dung muc luong dang hieu luc TRONG thang 07, khong
 * phai muc luong hom nay. Neu tra theo hom nay, mo lai bang luong thang 07 vao
 * thang 09 se ra mot con so khac — dung dieu ma `employee_pay_rates`
 * append-only (D-37a) ton tai de chan.
 *
 * HE QUA DA BIET, ghi ro de nguoi sau khong phai doan: tang luong GIUA ky thi
 * CA KY an muc moi. Vi du muc luong moi hieu luc tu 15/07 thi ca thang 07 duoc
 * tinh theo muc do, khong phai nua thang muc cu cong nua thang muc moi.
 *
 * Do la mot lua chon, khong phai mot thieu sot: tinh theo tung ngay doi
 * `creditedDays` phai duoc tach ra theo tung khoang hieu luc, va do la mot mo
 * hinh khac han — chua duoc thiet ke, va se lam moi con so cua phase nay phuc
 * tap hon mot bac. Doanh nghiep muon tach dung thi khai muc luong moi tu ngay
 * DAU THANG ke tiep.
 */

const ADJUSTMENT_COLUMNS =
  "id, company_id, name, kind, value_type, value, basis, is_active, created_at";
const SCOPE_COLUMNS = "id, company_id, adjustment_id, mode, scope_type, scope_value";

export interface PayrollContext {
  /** Muc luong hieu luc tai ngay cuoi ky, theo `employeeId`. Thieu = chua khai. */
  payRateByEmployee: Map<string, Pick<PayRate, "unit" | "amount">>;
  /** TOAN BO danh muc khoan kem pham vi — loc `isActive`/pham vi o `compute.ts`. */
  adjustments: PayAdjustment[];
}

export async function loadPayrollContext({
  companyId,
  /** "YYYY-MM-DD" — ngay CUOI CUNG cua ky (bien tren, co bao gom). */
  periodEnd,
}: {
  companyId: string;
  periodEnd: string;
}): Promise<PayrollContext> {
  const supabase = await createServerSupabase();

  const [rateResult, adjustmentResult] = await Promise.all([
    // Doc MOI phien ban co `effective_from <= periodEnd` roi chon phien ban
    // moi nhat o tang ung dung. Goi `tf_pay_rate_at()` cho tung nguoi la mot
    // round-trip moi nguoi — cung lap luan da dan toi `resolveMultiplier()`
    // (ban JS cua `tf_overtime_multiplier`) o 04-05.
    //
    // Su trung lap nay duoc canh: phep chon o day va phep chon cua
    // `tf_pay_rate_at()` phai cho cung ket qua, va bai 3 cua
    // `pay-rates.test.ts` doi chieu dung hai phep do tren du lieu that.
    supabase
      .from("employee_pay_rates")
      .select("employee_id, unit, amount, effective_from")
      .eq("company_id", companyId)
      .lte("effective_from", periodEnd)
      .order("effective_from", { ascending: true }),
    supabase
      .from("pay_adjustments")
      .select(`${ADJUSTMENT_COLUMNS}, pay_adjustment_scopes(${SCOPE_COLUMNS})`)
      .eq("company_id", companyId),
  ]);

  if (rateResult.error) {
    throw new Error("Không thể tải mức lương của nhân viên.");
  }
  if (adjustmentResult.error) {
    throw new Error("Không thể tải danh mục phụ cấp và khấu trừ.");
  }

  // Sap tang dan theo `effective_from` roi ghi de: dong cuoi cung ghi de la
  // dong co `effective_from` LON NHAT ma van <= `periodEnd` — dung phien ban
  // dang hieu luc.
  const payRateByEmployee = new Map<string, Pick<PayRate, "unit" | "amount">>();
  for (const raw of (rateResult.data ?? []) as Array<{
    employee_id: string;
    unit: "month" | "day" | "hour";
    amount: string | number;
  }>) {
    payRateByEmployee.set(raw.employee_id, {
      unit: raw.unit,
      amount: Number(raw.amount),
    });
  }

  const adjustments = ((adjustmentResult.data ?? []) as unknown[]).map((row) =>
    payAdjustmentRowSchema.parse(row),
  );

  return { payRateByEmployee, adjustments };
}
