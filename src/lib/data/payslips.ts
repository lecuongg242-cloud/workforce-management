import { fetchJson } from "@/lib/data/fetch-json";
import {
  payslipListResponseSchema,
  payslipResponseSchema,
} from "@/lib/validation/api/payslips";
import type { PayslipDetail, PayslipSummary } from "@/lib/types/domain";

/**
 * Phieu luong cua CHINH nguoi dang nhap (PAY-05).
 *
 * Khong ham nao o day nhan `employeeId` hay `companyId` — pham vi den tu phien
 * (D-12b). Neu mot man hinh nao do can xem phieu cua NGUOI KHAC thi do la mot
 * duong doc khac han, voi mot phep kiem quyen khac, chu khong phai them mot
 * tham so vao day.
 */

/**
 * Cac ky ma nguoi dang nhap co phieu, moi nhat truoc — gom ca ky DANG MO
 * (`status: "provisional"`) neu thang hien tai chua duoc chot.
 */
export async function listMyPayslips(): Promise<PayslipSummary[]> {
  return fetchJson("/api/payslips", payslipListResponseSchema);
}

/**
 * Chi tiet phieu cua mot ky — da chot hoac tam tinh, phan biet bang `status`.
 *
 * `null` khi ky do khong co gi de xem: nguoi nay chua lam viec o ky do, hoac
 * ky khong ton tai. Hai truong hop CO Y khong phan biet duoc voi nhau (xem
 * chu thich cua Route Handler).
 */
export async function getMyPayslip(
  month: string,
): Promise<PayslipDetail | null> {
  return fetchJson(
    `/api/payslips/${encodeURIComponent(month)}`,
    payslipResponseSchema.nullable(),
  );
}
