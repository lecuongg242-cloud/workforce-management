import { z } from "zod";

/**
 * Schema Zod cho cau hinh doanh nghiep (plan 04-01), theo dung khuon
 * `work-sites.ts` (D-12d):
 * - `companySettingsRowSchema` — dong THO tu Supabase (snake_case), CHI dung
 *   o server ngay sau khi doc DB.
 * - `companySettingsSchema` — hinh dang cuoi cung (camelCase), dung o CA HAI
 *   dau cho hop dong JSON.
 * - `companySettingsInputSchema` — dau vao GHI. Moi truong TUY CHON (patch
 *   tung phan) va KHONG truong nao khai dinh danh doanh nghiep (D-12b):
 *   companyId luon tu `getSessionContext()`.
 *
 * Rang buoc so KHOP DUNG rang buoc CHECK cua
 * `supabase/migrations/0015_company_settings.sql`.
 */

/** `time` cua Postgres ve dang "HH:mm:ss"; hop dong JSON cua du an dung "HH:mm". */
function toHourMinute(time: string): string {
  return time.slice(0, 5);
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const companySettingsRowSchema = z
  .object({
    company_id: z.string(),
    // Postgres `numeric` ve JS qua PostgREST co the la so hoac chuoi tuy
    // driver — ep ve so o day de tang tren khong bao gio phai doan.
    suspicious_distance_multiplier: z.coerce.number(),
    shift_window_grace_minutes: z.number(),
    night_start_time: z.string(),
    night_end_time: z.string(),
    // `numeric` nullable: `null` la KHONG GIOI HAN (SET-05). `z.coerce` chi ap
    // khi co gia tri — `nullable()` dat NGOAI de `null` di thang qua, khong bi
    // ep thanh 0.
    overtime_cap_hours_per_month: z.coerce.number().nullable(),
    updated_at: z.string(),
    updated_by: z.string().nullable(),
  })
  .transform((row) => ({
    companyId: row.company_id,
    suspiciousDistanceMultiplier: row.suspicious_distance_multiplier,
    shiftWindowGraceMinutes: row.shift_window_grace_minutes,
    nightStartTime: toHourMinute(row.night_start_time),
    nightEndTime: toHourMinute(row.night_end_time),
    overtimeCapHoursPerMonth: row.overtime_cap_hours_per_month,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }));

export const companySettingsSchema = z.object({
  companyId: z.string(),
  suspiciousDistanceMultiplier: z.number(),
  shiftWindowGraceMinutes: z.number(),
  nightStartTime: z.string(),
  nightEndTime: z.string(),
  overtimeCapHoursPerMonth: z.number().nullable(),
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
});

/**
 * Moi truong tuy chon — truong khong co mat trong patch giu nguyen gia tri
 * cu (xem `updateCompanySettings`). Rang buoc "night_start <> night_end"
 * KHONG kiem duoc o day vi patch co the chi mang mot trong hai moc; no duoc
 * kiem sau khi hop nhat voi dong hien tai, o tang Server Action, va con mot
 * lop CHECK o database nua.
 */
export const companySettingsInputSchema = z.object({
  suspiciousDistanceMultiplier: z
    .number({ invalid_type_error: "Vui lòng nhập ngưỡng đáng ngờ." })
    .positive("Ngưỡng đáng ngờ phải lớn hơn 0.")
    .max(999.99, "Ngưỡng đáng ngờ quá lớn.")
    .optional(),
  shiftWindowGraceMinutes: z
    .number({ invalid_type_error: "Vui lòng nhập biên độ khung giờ ca." })
    .int("Biên độ phải là số nguyên (đơn vị phút).")
    .min(0, "Biên độ không được là số âm.")
    .max(720, "Biên độ không vượt quá 720 phút (12 giờ).")
    .optional(),
  nightStartTime: z
    .string()
    .regex(TIME_PATTERN, "Giờ bắt đầu ca đêm phải theo định dạng HH:mm.")
    .optional(),
  nightEndTime: z
    .string()
    .regex(TIME_PATTERN, "Giờ kết thúc ca đêm phải theo định dạng HH:mm.")
    .optional(),
  // SET-05. `nullable()` la mot gia tri CO NGHIA o day (xoa tran = khong gioi
  // han), khac `optional()` (khong gui truong nay = giu nguyen gia tri cu).
  // Ca hai deu can, va chung khong thay the nhau duoc.
  overtimeCapHoursPerMonth: z
    .number({ invalid_type_error: "Trần tăng ca phải là một con số." })
    .positive("Trần tăng ca phải lớn hơn 0 — để trống nếu không giới hạn.")
    .max(9999.99, "Trần tăng ca quá lớn.")
    .nullable()
    .optional(),
});
