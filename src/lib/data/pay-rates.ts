import { fetchJson } from "@/lib/data/fetch-json";
import { payRateHistorySchema } from "@/lib/validation/api/pay-rates";
import type { PayRateHistory } from "@/lib/types/domain";

/**
 * Toan bo lich su muc luong cua MOT nhan vien (PAY-06, plan 05-2-01), moi nhat
 * truoc, kem phien ban dang hieu luc hom nay. Nhan vien chua khai lan nao tra
 * `current: null` va `versions: []` — KHONG BAO GIO 0 (D-26).
 *
 * Chi `owner`/`admin` goi duoc (D-44). Vai tro khac nhan 403 KE CA khi hoi
 * chinh minh: nhan vien chua xem duoc luong cua minh o phase nay (PAY-05 van
 * o V3).
 */
export async function getPayRateHistory(
  employeeId: string,
): Promise<PayRateHistory> {
  return fetchJson(
    `/api/pay-rates?employeeId=${encodeURIComponent(employeeId)}`,
    payRateHistorySchema,
  );
}

export { createPayRate } from "@/lib/data/mutations/pay-rates";
