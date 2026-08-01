import { fetchJson } from "@/lib/data/fetch-json";
import { shiftListResponseSchema } from "@/lib/validation/api/shifts";
import type { Shift } from "@/lib/types/domain";

/**
 * Kieu chuyen nha tu tang gia lap (`mock/service.ts`) sang day — giu nguyen
 * ten va hinh dang de call site khong phai sua (plan 02-06).
 */
export interface ShiftWithStats extends Shift {
  employeeCount: number;
}

/**
 * Chu ky giu Y HET `mock/service.ts` — tham so `companyId` giu trong chu ky
 * de call site khong phai sua, nhung KHONG gui len server va KHONG anh
 * huong pham vi truy van (D-12b), cung ly do voi `listDepartments`
 * (`src/lib/data/departments.ts`).
 */
export async function listShifts(companyId: string): Promise<ShiftWithStats[]> {
  void companyId;
  return fetchJson("/api/shifts", shiftListResponseSchema);
}

export { createShift, duplicateShift, updateShift } from "@/lib/data/mutations/shifts";
