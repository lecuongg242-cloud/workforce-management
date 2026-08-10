import { z } from "zod";

/**
 * Hinh dang day cua khu van hanh (Phase 6, SADM-01/SADM-03).
 *
 * Theo khuon D-12d: mot `*RowSchema` co `.transform()` snake_case -> camelCase
 * dung CHI o server, va mot schema phang dung o CA HAI dau. Hai schema thay vi
 * mot vi hinh dang doc tu database va hinh dang di tren day khac nhau ve quy
 * uoc dat ten, va gop lai thi mot trong hai dau se phai biet quy uoc cua dau
 * kia.
 */

/* -------------------------------------------------------------------------- */
/* Danh sach toan he thong (SADM-01)                                          */
/* -------------------------------------------------------------------------- */

export const platformCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  employeeCount: z.number(),
  /** ISO date-time, `null` khi doanh nghiep chua co lan cham cong nao */
  lastActivityAt: z.string().nullable(),
  /** "YYYY-MM", `null` khi khong co ky nao dang mo */
  openPeriodMonth: z.string().nullable(),
});

export const platformCompanyRowSchema = z
  .object({
    company_id: z.string(),
    company_name: z.string(),
    company_code: z.string(),
    employee_count: z.number(),
    last_activity_at: z.string().nullable(),
    open_period_start: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.company_id,
    name: row.company_name,
    code: row.company_code,
    employeeCount: row.employee_count,
    lastActivityAt: row.last_activity_at,
    // RPC tra `start_date` cua ky dang mo (ky bi ep tron thang duong lich —
    // D-09), cat lay "YYYY-MM" o day de giao dien khong phai biet quy uoc do.
    openPeriodMonth: row.open_period_start
      ? row.open_period_start.slice(0, 7)
      : null,
  }));

export const platformCompanyListResponseSchema = z.array(platformCompanySchema);

export type PlatformCompany = z.infer<typeof platformCompanySchema>;

/* -------------------------------------------------------------------------- */
/* Nhat ky phien ho tro (SADM-03)                                             */
/* -------------------------------------------------------------------------- */

export const supportSessionLogEntrySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companyName: z.string(),
  reason: z.string(),
  /** ISO date-time */
  openedAt: z.string(),
  expiresAt: z.string(),
  closedAt: z.string().nullable(),
});

export const supportSessionLogResponseSchema = z.array(
  supportSessionLogEntrySchema,
);

export type SupportSessionLogEntry = z.infer<
  typeof supportSessionLogEntrySchema
>;
