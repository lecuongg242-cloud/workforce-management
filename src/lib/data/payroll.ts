import { fetchJson } from "@/lib/data/fetch-json";
import { payrollPrepSchema } from "@/lib/validation/api/payroll";
import type { PayrollPrep } from "@/lib/types/domain";

/**
 * Bang CHUAN BI luong cua mot thang — mot dong cho moi nhan vien dang lam
 * viec, khong con so tien nao (xem `PayrollPrepRow` trong `domain.ts`).
 *
 * Khong tham so nao khai dinh danh doanh nghiep: pham vi tu phien (D-12b).
 */
export async function getPayrollPrep(month: string): Promise<PayrollPrep> {
  return fetchJson(
    `/api/payroll/summary?month=${encodeURIComponent(month)}`,
    payrollPrepSchema,
  );
}
