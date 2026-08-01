import { fetchJson } from "@/lib/data/fetch-json";
import { workRequestListResponseSchema } from "@/lib/validation/api/requests";
import type { RequestQuery, WorkRequest } from "@/lib/types/domain";

export { createRequest } from "@/lib/data/mutations/requests";

/**
 * Chu ky giu Y HET `mock/service.ts` — call site chi doi dong import (plan
 * 02-09). `query.companyId` KHONG bao gio gui len server — pham vi luon den
 * tu `getSessionContext()` (D-12b), cung ly do voi `listAttendance`.
 * `status: "all"` van duoc gui len (Route Handler tu dien giai la khong loc).
 */
export async function listRequests(query: RequestQuery): Promise<WorkRequest[]> {
  const params = new URLSearchParams();
  if (query.employeeId) params.set("employeeId", query.employeeId);
  if (query.status) params.set("status", query.status);

  const qs = params.toString();
  return fetchJson(`/api/requests${qs ? `?${qs}` : ""}`, workRequestListResponseSchema);
}
