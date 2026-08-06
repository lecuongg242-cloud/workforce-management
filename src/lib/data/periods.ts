import { fetchJson } from "@/lib/data/fetch-json";
import { periodSummaryListResponseSchema } from "@/lib/validation/api/periods";
import type { PeriodSummary } from "@/lib/types/domain";

export { closePeriod } from "@/lib/data/mutations/periods";

/**
 * Ky cong cua doanh nghiep trong phien, moi nhat truoc, kem so lieu tom tat.
 * Khong tham so nao khai dinh danh doanh nghiep — pham vi tu phien (D-12b).
 */
export async function listPeriods(): Promise<PeriodSummary[]> {
  return fetchJson("/api/periods", periodSummaryListResponseSchema);
}
