"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { fetchJson } from "@/lib/data/fetch-json";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  attendancePhotoListResponseSchema,
  attendancePhotoRowSchema,
} from "@/lib/validation/api/attendance-photos";
import type { AttendancePhoto } from "@/lib/types/domain";

export { markPhotoReviewed } from "@/lib/data/mutations/attendance-photos";

/**
 * Dung boi `AttendancePhotoDialog` (plan 03-05) — doc TOAN BO sieu du lieu
 * anh cua mot ban ghi cham cong (toi da hai phan tu: check_in/check_out) qua
 * `GET /api/attendance-photos`. Khac voi `getAttendancePhotoForRecord` ben
 * duoi (Server Action goi thang mot lan cham), ham nay di qua Route Handler
 * vi Dialog can CA hai lan cham cung luc, khong phai tung lan rieng le.
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

/**
 * [Rule 2 — bo sung chuc nang thieu] File nay KHONG nam trong danh sach
 * `<files>` cua Task 3 (03-01-PLAN.md), nhung `<behavior>`/`<acceptance_criteria>`
 * cua Task 3 doi hoi `AttendancePhotoDialog` biet duoc MOT ban ghi cham cong
 * co dong `attendance_photos` hay khong TRUOC KHI no co the quyet dinh hien
 * anh hay hien "Bản ghi này không có ảnh đính kèm.". Khong co duong nao khac
 * trong plan nay tra ve thong tin do: broker `GET /api/attendance-photos/[id]`
 * (Task 2) nhan THANG id cua anh, khong nhan id cua ban ghi cham cong. Day
 * la mieng ghep con thieu — bo sung theo dung khuon Server Action da co cua
 * `checkIn`/`checkOut` (khong phai Route Handler, nen khong cham cong D-12c).
 *
 * ATT-04: chi owner/admin duoc goi — cung khuon phan quyen voi broker route.
 */
export async function getAttendancePhotoForRecord(
  attendanceRecordId: string,
  kind: "check_in" | "check_out" = "check_in",
): Promise<AttendancePhoto | null> {
  const { companyId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("attendance_photos")
    .select(
      "id, company_id, attendance_record_id, kind, captured_at, latitude, longitude, accuracy_meters, work_site_id, distance_meters, review_status, work_sites(name)",
    )
    .eq("attendance_record_id", attendanceRecordId)
    .eq("kind", kind)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error("Không thể tải ảnh chấm công.");
  }
  if (!data) return null;

  // Supabase-js khong biet truoc mot-doi-mot hay mot-doi-nhieu cho quan he
  // nhung PostgREST embed nen suy dien kieu mang; work_site_id la khoa
  // ngoai don, thuc te luon la mot dong hoac khong co.
  const row = data as unknown as Record<string, unknown> & {
    work_sites?: { name: string }[] | { name: string } | null;
  };
  const workSite = Array.isArray(row.work_sites)
    ? (row.work_sites[0] ?? null)
    : (row.work_sites ?? null);

  return attendancePhotoRowSchema.parse({
    ...row,
    work_site_name: workSite?.name ?? null,
  });
}
