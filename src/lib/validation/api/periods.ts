import { z } from "zod";

/**
 * Schema Zod cho ky cong (plan 05-05), theo dung khuon D-12d: mot schema
 * "row" transform snake_case -> camelCase ngay sau khi doc DB, va mot schema
 * "plain" dung o CA HAI dau.
 *
 * `closedAt`/`closedBy` la `null` khi ky dang mo — hai truong nay la vet cua
 * mot thao tac MOT CHIEU (D-32b), nen chung khong bao gio quay ve `null` sau
 * khi da co gia tri.
 */

export const periodStatusSchema = z.enum(["open", "closed"]);

export const periodRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    status: periodStatusSchema,
    closed_at: z.string().nullable(),
    closed_by: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
  }));

export const periodPlainSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: periodStatusSchema,
  closedAt: z.string().nullable(),
  closedBy: z.string().nullable(),
});

/** Ky kem so lieu tom tat — hop dong cua `GET /api/periods`. */
export const periodSummarySchema = periodPlainSchema.extend({
  month: z.string(),
  employeeCount: z.number().int(),
  recordCount: z.number().int(),
  pendingRequestCount: z.number().int(),
  hasEnded: z.boolean(),
});

export const periodSummaryListResponseSchema = z.array(periodSummarySchema);

/**
 * Dau vao cua `closePeriod()`: DUY NHAT mot thang "YYYY-MM". Khong truong
 * dinh danh doanh nghiep nao (D-12b), va khong nhan `startDate`/`endDate`
 * rieng — ky bi ep tron thang duong lich (D-09) nen mot thang la du de xac
 * dinh no, va nhan hai moc rieng se mo duong cho mot khoang khong tron thang.
 */
export const closePeriodInputSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Tháng phải theo định dạng YYYY-MM."),
});
