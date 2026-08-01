import { fetchJson } from "@/lib/data/fetch-json";
import { companyListResponseSchema } from "@/lib/validation/api/companies";
import type { Company } from "@/lib/types/domain";

/**
 * Chu ky giu Y HET `src/lib/mock/service.ts` — call site chi doi dong
 * import, khong doi cach goi.
 */
export async function listCompanies(): Promise<Company[]> {
  return fetchJson("/api/companies", companyListResponseSchema);
}

export async function getCompany(id: string): Promise<Company | null> {
  // Danh sach doanh nghiep cua mot nguoi luon nho -- khong dung them
  // endpoint rieng cho mot phep loc.
  const companies = await listCompanies();
  return companies.find((company) => company.id === id) ?? null;
}

export { createCompany } from "@/lib/data/mutations/companies";
