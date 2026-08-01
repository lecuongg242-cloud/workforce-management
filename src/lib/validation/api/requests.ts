import { z } from "zod";

/**
 * Schema Zod cho yeu cau (plan 02-09). Cung khuon D-12d voi
 * `employeeRowSchema`/`shiftRowSchema`: mot schema "row" (`workRequestSchema`)
 * transform snake_case -> camelCase NGAY SAU khi doc DB, va mot schema
 * "plain" (`workRequestPlainSchema`) khong transform dung o CA HAI dau cho
 * hop dong JSON cuoi cung (Route Handler parse mang da-anh-xa truoc khi tra
 * ve, `src/lib/data/requests.ts` parse lai sau khi nhan qua `fetchJson`).
 *
 * `from_time`/`to_time` la cot `time` cua Postgres, PostgREST tra ve dang
 * "HH:MM:SS" — cat con "HH:mm" giong `shiftRowSchema.start_time/end_time`,
 * `null` giu nguyen `null` (chi dung cho attendance_supplement/time_adjustment).
 * `created_at` la `timestamptz`, PostgREST da tra ve dung dang chuoi ISO nen
 * khong can bien doi gia tri, chi doi ten truong.
 */

export const requestTypeSchema = z.enum([
  "leave",
  "attendance_supplement",
  "time_adjustment",
  "overtime",
]);

export const requestStatusSchema = z.enum(["pending", "approved", "rejected"]);

/** "HH:MM:SS" (Postgres time) -> "HH:mm" (domain/giao dien); null giu nguyen. */
function cutSecondsNullable(value: string | null): string | null {
  return value === null ? null : value.slice(0, 5);
}

/**
 * Dong tho tu Supabase (`select(...)` tren `work_requests`) — CHI dung o
 * server, ngay sau khi doc DB.
 */
export const workRequestSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    employee_id: z.string(),
    type: requestTypeSchema,
    status: requestStatusSchema,
    from_date: z.string(),
    to_date: z.string(),
    from_time: z.string().nullable(),
    to_time: z.string().nullable(),
    reason: z.string(),
    created_at: z.string(),
    reviewer_id: z.string().nullable(),
    review_note: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    type: row.type,
    status: row.status,
    fromDate: row.from_date,
    toDate: row.to_date,
    fromTime: cutSecondsNullable(row.from_time),
    toTime: cutSecondsNullable(row.to_time),
    reason: row.reason,
    createdAt: row.created_at,
    reviewerId: row.reviewer_id,
    reviewNote: row.review_note,
  }));

/** Hinh dang `WorkRequest` cua domain.ts — dung o ca hai dau (D-12d). */
export const workRequestPlainSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  type: requestTypeSchema,
  status: requestStatusSchema,
  fromDate: z.string(),
  toDate: z.string(),
  fromTime: z.string().nullable(),
  toTime: z.string().nullable(),
  reason: z.string(),
  createdAt: z.string(),
  reviewerId: z.string().nullable(),
  reviewNote: z.string().nullable(),
});

export const workRequestListResponseSchema = z.array(workRequestPlainSchema);

/**
 * Tham so truy van cua `GET /api/requests` — KHONG khai bat ky truong dinh
 * danh doanh nghiep nao (D-12b), pham vi luon den tu `getSessionContext()`.
 * `status: "all"` nghia la khong loc theo trang thai.
 */
export const requestQuerySchema = z.object({
  employeeId: z.string().optional(),
  status: z.union([requestStatusSchema, z.literal("all")]).optional(),
});

/**
 * Khop `WorkRequestInput` (`Pick<WorkRequest, "type" | "fromDate" | "toDate" |
 * "fromTime" | "toTime" | "reason">`) — dung CHI cho `createRequest` (plan
 * 02-09). KHONG khai `status`/`reviewerId`/`reviewNote`/`createdAt`: bon gia
 * tri do do server/database quyet dinh, nhan chung tu client la mo duong cho
 * mot yeu cau tu duyet chinh minh (T-02-09-02). `.transform()` tra ve dong
 * snake_case san sang ghi, them lai ":00" cho `fromTime`/`toTime` khi co gia
 * tri, khop kieu `time` cua Postgres — cung khuon voi `shiftInputSchema`.
 */
export const workRequestInputSchema = z
  .object({
    type: requestTypeSchema,
    fromDate: z.string(),
    toDate: z.string(),
    fromTime: z.string().nullable(),
    toTime: z.string().nullable(),
    reason: z.string(),
  })
  .transform((input) => ({
    type: input.type,
    from_date: input.fromDate,
    to_date: input.toDate,
    from_time: input.fromTime ? `${input.fromTime}:00` : null,
    to_time: input.toTime ? `${input.toTime}:00` : null,
    reason: input.reason,
  }));
