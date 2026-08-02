import { z } from "zod";

import { ALLOWED_PHOTO_MIME_TYPES } from "@/lib/storage/attendance-photos";

/**
 * Schema Zod cho bang chung cham cong (plan 03-01). Khuon hai dau giong
 * `shiftRowSchema`/`shiftWithStatsSchema` (D-12d):
 * - `attendancePhotoRowSchema` — dong THO tu Supabase, transform snake_case
 *   -> camelCase, CHI dung o server ngay sau khi doc DB.
 * - `attendancePhotoSchema` — hinh dang cuoi cung (camelCase), dung o CA HAI
 *   dau cho hop dong JSON.
 * - `punchEvidenceSchema` — thu client GUI KEM khi cham cong. KHONG khai
 *   truong khoang cach nao o day: `distance_meters` luon do server tinh qua
 *   `tf_distance_meters()`, khong bao gio la mot truong dau vao (D-20/T-03-04).
 */

export const attendancePhotoKindSchema = z.enum(["check_in", "check_out"]);

export const photoReviewStatusSchema = z.enum(["pending", "approved", "rejected"]);

/**
 * Bang chung mot lan cham cong ma client GUI LEN — day la loi khai cua
 * client, CHUA phai bang chung cho toi khi server tu do lai (toa do that su
 * dung khi tinh khoang cach van la gia tri nay, nhung KHONG mot truong nao o
 * day duoc phep la "khoang cach" hay "dau thoi gian chup" — hai gia tri do
 * server tu tinh/tu cap, khong bao gio nhan tu tham so).
 */
export const punchEvidenceSchema = z.object({
  photo: z
    .instanceof(Blob)
    .refine(
      (blob) => (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(blob.type),
      "Định dạng ảnh không được hỗ trợ.",
    )
    .refine((blob) => blob.size > 0, "Ảnh chụp bị rỗng."),
  // Khop dung CHECK cua bang work_sites (latitude between -90 and 90).
  latitude: z.number().min(-90).max(90),
  // Khop dung CHECK cua bang work_sites (longitude between -180 and 180).
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative(),
});

/**
 * Dong tho tu Supabase (`select(...)` tren `attendance_photos`, co the ghep
 * them `work_site_name` qua join/alias tu `work_sites`) — CHI dung o server.
 * `work_site_name` la optional o dau vao vi mot so truy van (vi du broker
 * route chi doc chinh `attendance_photos`) khong join sang `work_sites`.
 */
export const attendancePhotoRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    attendance_record_id: z.string(),
    kind: attendancePhotoKindSchema,
    captured_at: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    accuracy_meters: z.number().nullable(),
    work_site_id: z.string().nullable(),
    work_site_name: z.string().nullable().optional(),
    distance_meters: z.number().nullable(),
    review_status: photoReviewStatusSchema,
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    attendanceRecordId: row.attendance_record_id,
    kind: row.kind,
    capturedAt: row.captured_at,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracy_meters,
    workSiteId: row.work_site_id,
    workSiteName: row.work_site_name ?? null,
    distanceMeters: row.distance_meters,
    reviewStatus: row.review_status,
  }));

/** Hinh dang `AttendancePhoto` cua domain.ts — dung o CA HAI dau (D-12d). */
export const attendancePhotoSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  attendanceRecordId: z.string(),
  kind: attendancePhotoKindSchema,
  capturedAt: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  accuracyMeters: z.number().nullable(),
  workSiteId: z.string().nullable(),
  workSiteName: z.string().nullable(),
  distanceMeters: z.number().nullable(),
  reviewStatus: photoReviewStatusSchema,
});

/**
 * Tham so truy van cua `GET /api/attendance-photos` (plan 03-05) — dung
 * MOT truong duy nhat: dinh danh ban ghi cham cong. KHONG khai dinh danh
 * doanh nghiep (D-12b) — pham vi luon den tu `getSessionContext()`.
 */
export const attendancePhotoQuerySchema = z.object({
  attendanceRecordId: z.string().min(1, "Thiếu tham số bản ghi chấm công."),
});

/**
 * Phan hoi cua `GET /api/attendance-photos` — mang toi da hai phan tu (mot
 * cho `check_in`, mot cho `check_out`, rang buoc `unique(attendance_record_id,
 * kind)` cua database dam bao dieu nay), KHONG mang bat ky truong nao dan
 * chieu toi mien luu tru (T-03-05-04).
 */
export const attendancePhotoListResponseSchema = z.array(attendancePhotoSchema);

/**
 * Dau vao cua hanh dong danh dau xem xet (`markPhotoReviewed`) — CHI nhan
 * trang thai. `reviewed_by`/`reviewed_at` luon do server cap tu phien va tu
 * dong ho database (`tf_server_now()`), khong bao gio la mot truong dau vao
 * (T-03-05-06).
 */
export const photoReviewInputSchema = z.object({
  status: photoReviewStatusSchema,
});
