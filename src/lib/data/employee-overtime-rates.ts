import { fetchJson } from "@/lib/data/fetch-json";
import { employeeOvertimeRateHistorySchema } from "@/lib/validation/api/overtime-rates";
import type { EmployeeOvertimeRateHistory } from "@/lib/types/domain";

/**
 * Toan bo lich su muc TANG CA RIENG cua MOT nhan vien (migration 0026), moi
 * nhat truoc, kem phien ban dang hieu luc hom nay.
 *
 * `current: null` nghia la nguoi do KHONG CO muc rieng — ho an theo he so cua
 * doanh nghiep, KHONG phai "tang ca bang 0".
 */
export async function getEmployeeOvertimeRateHistory(
  employeeId: string,
): Promise<EmployeeOvertimeRateHistory> {
  return fetchJson(
    `/api/overtime-rates?employeeId=${encodeURIComponent(employeeId)}`,
    employeeOvertimeRateHistorySchema,
  );
}

export { createEmployeeOvertimeRate } from "@/lib/data/mutations/employee-overtime-rates";
