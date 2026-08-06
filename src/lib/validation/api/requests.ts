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

/**
 * Hinh dang `WorkRequest` cua domain.ts — dung o ca hai dau (D-12d).
 *
 * Ba truong ngu canh (`employeeName`/`employeeCode`/`departmentName`) them o
 * plan 05-01: mot danh sach duyet chi co `employeeId` thi nguoi duyet phai tu
 * tra ai la ai — va ho se duyet ma khong tra. Chung `.default(null)` chu khong
 * `not null`: mot phan hoi cu (hoac mot noi goi chi quan tam den yeu cau, nhu
 * man hinh nhan vien) van parse duoc ma khong phai bia ra chuoi rong.
 */
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
  employeeName: z.string().nullable().default(null),
  employeeCode: z.string().nullable().default(null),
  departmentName: z.string().nullable().default(null),
});

export const workRequestListResponseSchema = z.array(workRequestPlainSchema);

/* -------------------------------------------------------------------------- */
/* Lich su xu ly (request_reviews, migration 0017 — plan 05-01)                */
/* -------------------------------------------------------------------------- */

export const reviewDecisionSchema = z.enum(["approved", "rejected"]);

/** Dong nhung cua PostgREST: object khi mot-mot, mang khi PostgREST doan la mot-nhieu. */
const reviewerJoinSchema = z
  .union([
    z.object({ full_name: z.string() }),
    z.array(z.object({ full_name: z.string() })),
    z.null(),
  ])
  .optional();

function firstOrSelf<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Dong tho tu `request_reviews` (co the kem embed `employees(full_name)`). */
export const requestReviewRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    request_id: z.string(),
    decision: reviewDecisionSchema,
    note: z.string().nullable(),
    reviewer_user_id: z.string().nullable(),
    reviewer_employee_id: z.string().nullable(),
    created_at: z.string(),
    employees: reviewerJoinSchema,
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    requestId: row.request_id,
    decision: row.decision,
    note: row.note,
    reviewerUserId: row.reviewer_user_id,
    reviewerEmployeeId: row.reviewer_employee_id,
    // `null` co nghia THAT: nguoi duyet khong co ho so nhan vien (mot quan tri
    // duoc moi truc tiep). Giao dien noi "Quan tri vien" thay vi bo trong —
    // khong bao gio bia mot cai ten.
    reviewerName: firstOrSelf(row.employees)?.full_name ?? null,
    createdAt: row.created_at,
  }));

/** Hinh dang `RequestReview` cua domain.ts — dung o ca hai dau (D-12d). */
export const requestReviewPlainSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  requestId: z.string(),
  decision: reviewDecisionSchema,
  note: z.string().nullable(),
  reviewerUserId: z.string().nullable(),
  reviewerEmployeeId: z.string().nullable(),
  reviewerName: z.string().nullable(),
  createdAt: z.string(),
});

export const requestReviewListResponseSchema = z.array(requestReviewPlainSchema);

/* -------------------------------------------------------------------------- */
/* Tac dong len du lieu cong (kieu SQL tf_request_effect, 0018 — plan 05-02)   */
/* -------------------------------------------------------------------------- */

/**
 * Hinh dang tho ma PostgREST tra ve cho mot ham SQL tra kieu composite:
 * mot object voi ten cot snake_case. `skipped_dates` la `date[]` cua Postgres
 * -> mang chuoi "YYYY-MM-DD".
 */
export const requestEffectRowSchema = z
  .object({
    inserted_count: z.number().int(),
    updated_count: z.number().int(),
    skipped_count: z.number().int(),
    skipped_dates: z.array(z.string()).nullable(),
  })
  .transform((row) => ({
    insertedCount: row.inserted_count,
    updatedCount: row.updated_count,
    skippedCount: row.skipped_count,
    skippedDates: row.skipped_dates ?? [],
  }));

/** Hinh dang `RequestEffect` cua domain.ts — dung o ca hai dau (D-12d). */
export const requestEffectPlainSchema = z.object({
  insertedCount: z.number().int(),
  updatedCount: z.number().int(),
  skippedCount: z.number().int(),
  skippedDates: z.array(z.string()),
});

/* -------------------------------------------------------------------------- */
/* Gio tang ca da dung trong thang (SET-05 — plan 05-03)                       */
/* -------------------------------------------------------------------------- */

/**
 * Hop dong cua `GET /api/requests/overtime-usage`. `capHours` la `null` khi
 * doanh nghiep CHUA DAT TRAN — khong phai 0, va khong phai "chua tai xong".
 */
export const overtimeUsageSchema = z.object({
  employeeId: z.string(),
  month: z.string(),
  /** Gio tang ca THUC TE tu du lieu cham cong (mo-dun Phase 4). */
  actualHours: z.number(),
  /** Gio da DANG KY o cac yeu cau tang ca khac da duoc duyet trong thang. */
  registeredHours: z.number(),
  /** `actualHours + registeredHours`. */
  usedHours: z.number(),
  capHours: z.number().nullable(),
});

/**
 * Dau vao cua `reviewRequest()`. KHONG khai `requestId` (tham so rieng) va
 * KHONG khai bat ky dinh danh doanh nghiep nao (D-12b).
 *
 * Rang buoc "tu choi phai co ly do" nam o day (lop mot), o rang buoc CHECK cua
 * migration 0017 (lop hai), va o form (lop tien nghi). Ba lop, mot quy tac.
 */
export const reviewRequestInputSchema = z
  .object({
    decision: reviewDecisionSchema,
    note: z.string().nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.decision !== "rejected") return;
    if (!input.note || input.note.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "Từ chối yêu cầu phải kèm lý do để người gửi biết vì sao.",
      });
    }
  });

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
