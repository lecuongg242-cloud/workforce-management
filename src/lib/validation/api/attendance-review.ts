import { z } from "zod";

import { attendancePhotoKindSchema, photoReviewStatusSchema } from "@/lib/validation/api/attendance-photos";

/**
 * Schema Zod cho danh sach "can xem lai" cua quan tri (D-21/ATT-07,
 * 03-06-PLAN.md Task 2). Khuon hai dau giong `attendancePhotoRowSchema`/
 * `attendancePhotoSchema` (D-12d):
 * - `attendanceReviewRowSchema` — dong DA GHEP (Route Handler tu gop tu hai
 *   truy van roi tinh boi so bang `suspiciousMultiplier()`), transform
 *   snake_case -> camelCase, CHI dung o server.
 * - `attendanceReviewItemSchema` — hinh dang cuoi cung (camelCase), dung o
 *   CA HAI dau cho hop dong JSON.
 * - `attendanceReviewQuerySchema` — tham so truy van TUY CHON (khoang thoi
 *   gian, trang thai xem xet); KHONG khai dinh danh doanh nghiep nao (D-12b)
 *   — pham vi luon den tu `getSessionContext()`.
 */

/**
 * Dong DA GHEP boi Route Handler: sieu du lieu anh cham cong (attendance_photos)
 * cong ten nhan vien (qua attendance_records -> employees) cong ten diem lam
 * viec (qua work_sites) cong boi so da tinh (`suspiciousMultiplier()`). Day
 * KHONG PHAI mot dong tho tu MOT bang duy nhat — no la ket qua sau khi Route
 * Handler da gop hai truy van va da loc bang `isSuspiciousPunch()`.
 */
/**
 * VI SAO danh sach can hai ly do (03-06 chi co mot).
 *
 * `far_from_site` — cham cong qua xa diem lam viec (D-21, nguong theo boi so
 * ban kinh). `outside_shift` — cham cong ngoai khung gio ca duoc phan; truoc
 * day day la mot cua CHAN o `checkIn`, nay chuyen thanh mot tin hieu de HOI,
 * cung khuon voi khoang cach (D-20 da lam dung viec do cho ban kinh).
 *
 * Ba truong `distanceMeters`/`workSiteName`/`multiplier` CHI co nghia voi
 * `far_from_site` nen deu nullable — mot lan cham dung gio ngay tai van phong
 * nhung sai khung gio ca khong co "khoang cach dang ngo" nao de bao cao, va
 * bia ra so 0 o do se doc thanh "cach 0 met", tuc la mot khang dinh sai.
 */
export const attendanceReviewReasonSchema = z.enum([
  "far_from_site",
  "outside_shift",
]);

export const attendanceReviewRowSchema = z
  .object({
    id: z.string(),
    attendance_record_id: z.string(),
    kind: attendancePhotoKindSchema,
    captured_at: z.string(),
    reason: attendanceReviewReasonSchema,
    distance_meters: z.number().nullable(),
    accuracy_meters: z.number().nullable(),
    review_status: photoReviewStatusSchema,
    employee_name: z.string(),
    work_site_name: z.string().nullable(),
    /** `suspiciousMultiplier()` — chi co gia tri voi ly do `far_from_site`. */
    multiplier: z.number().nullable(),
    /** Gio cham "HH:mm" va khung gio ca — chi co gia tri voi `outside_shift`. */
    punch_time: z.string().nullable(),
    shift_window: z.string().nullable(),
  })
  .transform((row) => ({
    photoId: row.id,
    attendanceRecordId: row.attendance_record_id,
    kind: row.kind,
    capturedAt: row.captured_at,
    reason: row.reason,
    distanceMeters: row.distance_meters,
    accuracyMeters: row.accuracy_meters,
    reviewStatus: row.review_status,
    employeeName: row.employee_name,
    workSiteName: row.work_site_name,
    multiplier: row.multiplier,
    punchTime: row.punch_time,
    shiftWindow: row.shift_window,
  }));

/** Hinh dang cuoi cung — dung o CA HAI dau (D-12d). */
export const attendanceReviewItemSchema = z.object({
  photoId: z.string(),
  attendanceRecordId: z.string(),
  kind: attendancePhotoKindSchema,
  capturedAt: z.string(),
  reason: attendanceReviewReasonSchema,
  distanceMeters: z.number().nullable(),
  accuracyMeters: z.number().nullable(),
  reviewStatus: photoReviewStatusSchema,
  employeeName: z.string(),
  workSiteName: z.string().nullable(),
  multiplier: z.number().nullable(),
  punchTime: z.string().nullable(),
  shiftWindow: z.string().nullable(),
});

export const attendanceReviewListResponseSchema = z.array(attendanceReviewItemSchema);

/**
 * Tham so truy van cua `GET /api/attendance/review` — TUY CHON, khong khai
 * dinh danh doanh nghiep nao (D-12b). `from`/`to` loc theo `captured_at`
 * (ISO date-time hoac date, so sanh chuoi theo dinh dang ISO van dung thu
 * tu). `reviewStatus` loc theo trang thai xem xet cua anh.
 */
export const attendanceReviewQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  reviewStatus: photoReviewStatusSchema.optional(),
});
