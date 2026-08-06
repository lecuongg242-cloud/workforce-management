import { fetchJson } from "@/lib/data/fetch-json";
import { overtimeRuleListResponseSchema } from "@/lib/validation/api/overtime-rules";
import type { OvertimeRuleGroup } from "@/lib/types/domain";

/**
 * Bon loai ngay kem he so DANG HIEU LUC hom nay va lich su phien ban cua tung
 * loai (SET-03, plan 04-04). Loai chua khai tra `currentMultiplier: null` —
 * KHONG BAO GIO 1.0 (D-26).
 */
export async function listOvertimeRules(): Promise<OvertimeRuleGroup[]> {
  return fetchJson("/api/overtime-rules", overtimeRuleListResponseSchema);
}

export { createOvertimeRuleVersion } from "@/lib/data/mutations/overtime-rules";
