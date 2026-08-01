import { fetchJson } from "@/lib/data/fetch-json";
import { departmentListResponseSchema } from "@/lib/validation/api/departments";
import type { Department } from "@/lib/types/domain";

/**
 * Kieu chuyen nha tu tang gia lap (`mock/service.ts`) sang day — giu nguyen
 * ten va hinh dang de call site khong phai sua (plan 02-05).
 */
export interface DepartmentWithStats extends Department {
  employeeCount: number;
  managerName: string | null;
}

/**
 * Chu ky giu Y HET `mock/service.ts` — tham so `companyId` giu trong chu ky
 * de call site khong phai sua, nhung KHONG gui len server va KHONG anh
 * huong pham vi truy van (D-12b), cung ly do voi `listAllEmployees`
 * (`src/lib/data/employees.ts`).
 */
export async function listDepartments(
  companyId: string,
): Promise<DepartmentWithStats[]> {
  void companyId;
  return fetchJson("/api/departments", departmentListResponseSchema);
}

export {
  createDepartment,
  deleteDepartment,
  updateDepartment,
} from "@/lib/data/mutations/departments";
