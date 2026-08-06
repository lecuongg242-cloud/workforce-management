import { fetchJson } from "@/lib/data/fetch-json";
import { holidayListResponseSchema } from "@/lib/validation/api/holidays";
import type { Holiday } from "@/lib/types/domain";

/**
 * Ngay nghi le cua doanh nghiep trong phien, theo nam (SET-02, plan 04-03).
 * Khong truyen `year` thi Route Handler lay nam hien tai theo DONG HO SERVER.
 */
export async function listHolidays(year?: number): Promise<Holiday[]> {
  const query = year === undefined ? "" : `?year=${year}`;
  return fetchJson(`/api/holidays${query}`, holidayListResponseSchema);
}

export {
  countAffectedAttendance,
  createHoliday,
  deleteHoliday,
  updateHoliday,
} from "@/lib/data/mutations/holidays";
