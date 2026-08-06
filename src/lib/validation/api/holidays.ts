import { z } from "zod";

/**
 * Schema Zod cho ngay nghi le (SET-02, plan 04-03), theo khuon `work-sites.ts`
 * (D-12d): `holidayRowSchema` (dong tho DB, chi dung o server),
 * `holidaySchema` (hinh dang cuoi cung, dung o ca hai dau),
 * `holidayInputSchema` (dau vao GHI), `holidayQuerySchema` (tham so doc).
 *
 * Ngay le la NGAY LICH, khong phai mot khoanh khac — khong co mui gio nao
 * tham gia vao module nay. Dinh dang luu va truyen deu la "YYYY-MM-DD".
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const holidayRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    holiday_date: z.string(),
    name: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    date: row.holiday_date,
    name: row.name,
  }));

export const holidaySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  date: z.string(),
  name: z.string(),
});

export const holidayListResponseSchema = z.array(holidaySchema);

/**
 * Dau vao GHI. KHONG khai truong dinh danh doanh nghiep nao (D-12b) —
 * companyId luon tu `getSessionContext()`.
 */
export const holidayInputSchema = z
  .object({
    date: z
      .string()
      .regex(DATE_PATTERN, "Vui lòng chọn ngày nghỉ lễ.")
      .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        "Ngày nghỉ lễ không hợp lệ.",
      ),
    name: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập tên ngày nghỉ lễ.")
      .max(120, "Tên ngày nghỉ lễ quá dài."),
  })
  .transform((input) => ({
    holiday_date: input.date,
    name: input.name,
  }));

/**
 * `year` tuy chon: khong truyen thi Route Handler lay nam hien tai THEO GIO
 * SERVER (`tf_server_now`), khong theo dong ho may nguoi dung (D-19).
 */
export const holidayQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(1900, "Năm không hợp lệ.")
    .max(2999, "Năm không hợp lệ.")
    .optional(),
});
