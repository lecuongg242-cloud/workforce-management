import { fetchJson } from "@/lib/data/fetch-json";
import {
  payslipListResponseSchema,
  payslipSchema,
} from "@/lib/validation/api/payslips";
import type { Payslip, PayslipSummary } from "@/lib/types/domain";

/**
 * Phieu luong cua CHINH nguoi dang nhap (PAY-05).
 *
 * Khong ham nao o day nhan `employeeId` hay `companyId` — pham vi den tu phien
 * (D-12b). Neu mot man hinh nao do can xem phieu cua NGUOI KHAC thi do la mot
 * duong doc khac han, voi mot phep kiem quyen khac, chu khong phai them mot
 * tham so vao day.
 */

/** Cac ky da chot luong ma nguoi dang nhap co phieu, moi nhat truoc. */
export async function listMyPayslips(): Promise<PayslipSummary[]> {
  return fetchJson("/api/payslips", payslipListResponseSchema);
}

/**
 * Chi tiet phieu cua mot ky. `null` khi ky do khong co phieu — ky chua chot
 * luong, hoac nguoi nay chua lam viec o ky do. Hai truong hop CO Y khong phan
 * biet duoc voi nhau (xem chu thich cua Route Handler).
 */
export async function getMyPayslip(month: string): Promise<Payslip | null> {
  return fetchJson(
    `/api/payslips/${encodeURIComponent(month)}`,
    payslipSchema.nullable(),
  );
}
