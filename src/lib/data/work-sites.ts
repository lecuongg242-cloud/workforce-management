import { fetchJson } from "@/lib/data/fetch-json";
import { workSiteListResponseSchema } from "@/lib/validation/api/work-sites";
import type { WorkSite } from "@/lib/types/domain";

/**
 * Chu ky giu tham so `companyId` de nhat quan voi cac module chi em
 * (`listShifts`, `listDepartments`) nhung KHONG gui len server va KHONG anh
 * huong pham vi truy van (D-12b) — companyId cua Route Handler luon tu
 * `getSessionContext()`.
 */
export async function listWorkSites(companyId: string): Promise<WorkSite[]> {
  void companyId;
  return fetchJson("/api/work-sites", workSiteListResponseSchema);
}

export {
  archiveWorkSite,
  createWorkSite,
  updateWorkSite,
} from "@/lib/data/mutations/work-sites";
