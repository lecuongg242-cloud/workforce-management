import { z } from "zod";

/**
 * Schema Zod cho muc luong cua nhan vien (PAY-06, plan 05-2-01), theo dung
 * khuon `overtime-rules.ts` (D-12d): dong THO tu Supabase, hinh dang cuoi
 * cung dung o ca hai dau, va dau vao GHI.
 *
 * KHONG CO `.default()` O BAT KY TRUONG NAO, va day khong phai su so sot: mot
 * muc luong mac dinh lam man hinh trong nhu da khai xong trong khi chua ai
 * khai gi (D-26) — va o day no ra tien.
 *
 * KHONG CO TRUONG NAO KHAI DINH DANH DOANH NGHIEP (D-12b): `companyId` luon
 * den tu `getSessionContext()`, khong bao gio tu tham so cua client.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Ba don vi luong khai duoc cho tung nguoi (D-37), khop CHECK cua migration 0022. */
export const PAY_RATE_UNITS = ["month", "day", "hour"] as const;

export const payRateUnitSchema = z.enum(PAY_RATE_UNITS);

export const payRateRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    employee_id: z.string(),
    unit: payRateUnitSchema,
    // `numeric` cua Postgres ve JS qua PostgREST co the la so hoac chuoi tuy
    // driver — ep ve so o day de tang tren khong bao gio phai doan.
    amount: z.coerce.number(),
    effective_from: z.string(),
    created_at: z.string(),
    created_by: z.string().nullable(),
    voided_at: z.string().nullable(),
    voided_by: z.string().nullable(),
    void_reason: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    unit: row.unit,
    amount: row.amount,
    effectiveFrom: row.effective_from,
    createdAt: row.created_at,
    createdBy: row.created_by,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
  }));

export const payRateSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  unit: payRateUnitSchema,
  amount: z.number(),
  effectiveFrom: z.string(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
  /**
   * Ten nguoi khai, tang tren ghep vao tu `employees.user_id` — KHONG phai mot
   * cot cua `employee_pay_rates`, nen no khong co trong `payRateRowSchema`.
   * `null` khi `createdBy` cung `null` (khong ai khai) HOAC khi tra cuu khong
   * ra ten (nguoi khai khong co ho so nhan vien) — man hinh phan biet hai
   * truong hop nay bang chinh `createdBy`.
   */
  createdByName: z.string().nullable(),
  /**
   * Dau HUY mot dong KHAI NHAM (D-57). `voidedAt` khac `null` nghia la dong
   * nay KHONG con tinh vao muc luong nua — no o lai lich su de noi rang da co
   * nguoi khai nham va da huy, chu khong bien mat.
   */
  voidedAt: z.string().nullable(),
  voidedBy: z.string().nullable(),
  voidedByName: z.string().nullable(),
  voidReason: z.string().nullable(),
});

/**
 * Toan bo lich su muc luong cua MOT nhan vien kem phien ban DANG HIEU LUC hom
 * nay. `current` bang `null` nghia la CHUA KHAI — khong bao gio duoc ngam
 * hieu la 0 (cung quy tac voi `tf_pay_rate_at`).
 */
export const payRateHistorySchema = z.object({
  employeeId: z.string(),
  current: payRateSchema.nullable(),
  versions: z.array(payRateSchema),
  /**
   * Ngay CUOI CUNG cua ky da chot luong gan nhat (`null` khi chua chot ky
   * nao). Man hinh dung no de canh bao truoc khi huy: mot dong co hieu luc
   * tu truoc moc nay da di vao mot bang luong da chot, va bang do se KHONG
   * duoc tinh lai (D-57).
   */
  latestClosedPeriodEnd: z.string().nullable(),
});

export const payRateQuerySchema = z.object({
  employeeId: z.string().min(1),
});

/**
 * Dau vao HUY mot dong khai nham (D-57). Ly do BAT BUOC va khong duoc de
 * trong — huy mot con so tien ma khong noi vi sao la xoa mot su kien trong im
 * lang, cung lap luan da dat ra `reason` bat buoc cua `reopenPayroll` (D-45).
 */
export const rateVoidInputSchema = z.object({
  id: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(1, "Vui lòng nêu lý do huỷ — đây là dấu vết duy nhất giải thích vì sao dòng này bị bỏ.")
    .max(500, "Lý do quá dài."),
});

/**
 * Dau vao GHI — luon la MOT PHIEN BAN MOI (append-only, D-37a), khong bao gio
 * la mot phep sua de.
 */
export const payRateInputSchema = z
  .object({
    employeeId: z.string().min(1, "Vui lòng chọn nhân viên."),
    unit: payRateUnitSchema,
    amount: z
      .number({ invalid_type_error: "Vui lòng nhập số tiền." })
      .positive("Số tiền phải lớn hơn 0.")
      .max(999999999999, "Số tiền quá lớn."),
    effectiveFrom: z
      .string()
      .regex(DATE_PATTERN, "Vui lòng chọn ngày bắt đầu hiệu lực."),
  })
  .transform((input) => ({
    employee_id: input.employeeId,
    unit: input.unit,
    amount: input.amount,
    effective_from: input.effectiveFrom,
  }));
