import { fetchJson } from "@/lib/data/fetch-json";
import { payAdjustmentListResponseSchema } from "@/lib/validation/api/pay-adjustments";
import type { PayAdjustment } from "@/lib/types/domain";

/**
 * Danh muc phu cap / khau tru cua doanh nghiep kem pham vi cua tung khoan
 * (PAY-04, plan 05-2-03). Khoan dang bat truoc; khoan da tat VAN tra ve — no
 * la mot phan cua chinh sach va man hinh phai bat lai duoc.
 *
 * Chi `owner`/`admin` goi duoc; vai tro khac nhan 403.
 */
export async function listPayAdjustments(): Promise<PayAdjustment[]> {
  return fetchJson("/api/pay-adjustments", payAdjustmentListResponseSchema);
}

export {
  createPayAdjustment,
  deactivatePayAdjustment,
  updatePayAdjustment,
} from "@/lib/data/mutations/pay-adjustments";
