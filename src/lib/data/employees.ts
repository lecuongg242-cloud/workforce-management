import { fetchJson } from "@/lib/data/fetch-json";
import {
  employeeDetailResponseSchema,
  employeeListResponseSchema,
  paginatedEmployeeSchema,
} from "@/lib/validation/api/employees";
import type { Employee, EmployeeQuery, Paginated } from "@/lib/types/domain";

export {
  bulkMoveDepartment,
  createEmployee,
  updateEmployee,
} from "@/lib/data/mutations/employees";

/**
 * Chu ky giu Y HET `src/lib/mock/service.ts` — call site chi doi dong
 * import, khong doi cach goi (plan 02-05).
 */
export async function listEmployees(
  query: EmployeeQuery,
): Promise<Paginated<Employee>> {
  const params = new URLSearchParams();
  // `query.companyId` KHONG bao gio gui len server — pham vi luon den tu
  // `getSessionContext()` (D-12b). Neu client gui them mot tham so mang dinh
  // danh doanh nghiep, `employeeQuerySchema` khong khai truong do nen no bi
  // bo qua.
  if (query.search) params.set("search", query.search);
  if (query.departmentId) params.set("departmentId", query.departmentId);
  if (query.status) params.set("status", query.status);
  if (query.contractType) params.set("contractType", query.contractType);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));

  const qs = params.toString();
  return fetchJson(`/api/employees${qs ? `?${qs}` : ""}`, paginatedEmployeeSchema);
}

/**
 * Danh sach rut gon dung cho o chon "quan ly truc tiep", tim kiem nhanh...
 *
 * Tham so `companyId` giu NGUYEN trong chu ky de 17 call site khong phai
 * sua, nhung KHONG duoc gui len server va KHONG anh huong pham vi truy
 * van — pham vi luon den tu session (D-12b). Plan 02-11 la noi can nhac bo
 * tham so thua nay sau khi moi call site da chuyen xong.
 */
export async function listAllEmployees(companyId: string): Promise<Employee[]> {
  void companyId;
  return fetchJson("/api/employees?mode=all", employeeListResponseSchema);
}

/**
 * Doc mot ho so nhan vien qua `GET /api/employees/<id>`. Tra `null` khi
 * khong tim thay hoac `id` thuoc doanh nghiep khac (T-02-07-01) — khong bao
 * gio nem trong hai truong hop nay, giu dung chu ky cu cua `mock/service.ts`.
 */
export async function getEmployee(id: string): Promise<Employee | null> {
  return fetchJson(`/api/employees/${id}`, employeeDetailResponseSchema);
}
