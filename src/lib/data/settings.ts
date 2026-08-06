import { fetchJson } from "@/lib/data/fetch-json";
import { companySettingsSchema } from "@/lib/validation/api/settings";
import type { CompanySettings } from "@/lib/types/domain";

/**
 * Doc cau hinh cua doanh nghiep trong phien (plan 04-01). Khong nhan tham so:
 * doanh nghiep den tu phien phia server (D-12b), khong tu client.
 *
 * Phia SERVER khong dung ham nay — Route Handler va Server Action doc thang
 * qua `loadCompanySettings()` (`src/lib/settings/company-settings.ts`).
 */
export async function getCompanySettings(): Promise<CompanySettings> {
  return fetchJson("/api/settings", companySettingsSchema);
}

export { updateCompanySettings } from "@/lib/data/mutations/settings";
