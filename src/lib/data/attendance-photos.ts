import { fetchJson } from "@/lib/data/fetch-json";
import { attendancePhotoListResponseSchema } from "@/lib/validation/api/attendance-photos";
import type { AttendancePhoto } from "@/lib/types/domain";

export { markPhotoReviewed } from "@/lib/data/mutations/attendance-photos";

/**
 * Dung boi `AttendancePhotoDialog` (plan 03-05) — doc TOAN BO sieu du lieu
 * anh cua mot ban ghi cham cong (toi da hai phan tu: check_in/check_out) qua
 * `GET /api/attendance-photos`.
 *
 * [Rule 1 — don dep code chet] Ham `getAttendancePhotoForRecord` (Server
 * Action rieng le tung lan cham, do 03-01 them de phuc vu ban Dialog toi
 * gian) bi go bo khoi day: Dialog day du cua plan nay chuyen han sang ham
 * duoi, khong con noi goi nao khac dung ham cu — giu lai se la code chet.
 * Vi khong con Server Action nao trong file, chi thi "use server" cung bi
 * go bo (ham duoi di qua Route Handler bang `fetchJson`, khong phai RPC
 * server action).
 */
export async function listAttendancePhotos(
  attendanceRecordId: string,
): Promise<AttendancePhoto[]> {
  const params = new URLSearchParams({ attendanceRecordId });
  return fetchJson(
    `/api/attendance-photos?${params.toString()}`,
    attendancePhotoListResponseSchema,
  );
}
