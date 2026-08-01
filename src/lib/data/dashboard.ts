import { fetchJson } from "@/lib/data/fetch-json";
import { dashboardSummarySchema } from "@/lib/validation/api/dashboard";
import type { DashboardSummary } from "@/lib/types/domain";

/**
 * Chu ky giu Y HET `src/lib/mock/service.ts` — call site chi doi dong import
 * (plan 02-08). `companyId` KHONG bao gio gui len server — pham vi luon den
 * tu `getSessionContext()` (D-12b).
 */
export async function getDashboardSummary(
  companyId: string,
  date: string,
): Promise<DashboardSummary> {
  void companyId;
  const params = new URLSearchParams({ date });
  return fetchJson(`/api/dashboard?${params.toString()}`, dashboardSummarySchema);
}
