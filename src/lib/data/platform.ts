import { fetchJson } from "@/lib/data/fetch-json";
import {
  platformCompanyListResponseSchema,
  supportSessionLogResponseSchema,
  type PlatformCompany,
  type SupportSessionLogEntry,
} from "@/lib/validation/api/platform";

/** Danh sach toan he thong (SADM-01). */
export async function listPlatformCompanies(): Promise<PlatformCompany[]> {
  return fetchJson("/api/platform/companies", platformCompanyListResponseSchema);
}

/** Nhat ky moi phien ho tro da mo (SADM-03). */
export async function listSupportSessions(): Promise<SupportSessionLogEntry[]> {
  return fetchJson("/api/platform/sessions", supportSessionLogResponseSchema);
}

export type { PlatformCompany, SupportSessionLogEntry };
