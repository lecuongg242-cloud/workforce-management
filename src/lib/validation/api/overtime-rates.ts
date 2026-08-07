import { z } from "zod";

/**
 * Schema Zod cho MUC TANG CA RIENG cua mot nhan vien (migration 0026), theo
 * dung khuon `pay-rates.ts` (D-12d): dong THO tu Supabase, hinh dang cuoi cung
 * dung o ca hai dau, va dau vao GHI.
 *
 * KHONG CO `.default()` O BAT KY TRUONG NAO: khong khai gi nghia la nguoi do
 * an theo he so cua doanh nghiep, va do la mot trang thai KHAC voi "khai mot
 * gia tri mac dinh nao do".
 *
 * KHONG CO TRUONG NAO KHAI DINH DANH DOANH NGHIEP (D-12b).
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Hai kieu gia tri, khop CHECK cua migration 0026. */
export const OVERTIME_RATE_VALUE_TYPES = ["multiplier", "fixed_hourly"] as const;

export const overtimeRateValueTypeSchema = z.enum(OVERTIME_RATE_VALUE_TYPES);

export const employeeOvertimeRateRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    employee_id: z.string(),
    value_type: overtimeRateValueTypeSchema,
    // `numeric` cua Postgres ve JS qua PostgREST co the la so hoac chuoi tuy
    // driver — ep ve so o day de tang tren khong bao gio phai doan.
    value: z.coerce.number(),
    effective_from: z.string(),
    created_at: z.string(),
    created_by: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    valueType: row.value_type,
    value: row.value,
    effectiveFrom: row.effective_from,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));

export const employeeOvertimeRateSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  valueType: overtimeRateValueTypeSchema,
  value: z.number(),
  effectiveFrom: z.string(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
});

/**
 * Lich su muc tang ca rieng cua MOT nhan vien kem phien ban DANG HIEU LUC hom
 * nay. `current` bang `null` nghia la nguoi do KHONG CO muc rieng — ho an theo
 * he so cua doanh nghiep, khong phai "tang ca bang 0".
 */
export const employeeOvertimeRateHistorySchema = z.object({
  employeeId: z.string(),
  current: employeeOvertimeRateSchema.nullable(),
  versions: z.array(employeeOvertimeRateSchema),
});

export const employeeOvertimeRateQuerySchema = z.object({
  employeeId: z.string().min(1),
});

/**
 * Dau vao GHI — luon la MOT PHIEN BAN MOI (append-only), khong bao gio la mot
 * phep sua de.
 *
 * Hai kieu gia tri co hai bien tren khac han nhau, va ca hai deu duoc chan o
 * day de thong diep loi la mot cau tieng Viet chu khong phai mot rang buoc
 * CHECK cua Postgres:
 *   - `multiplier`   : 0 < he so <= 10 (10 lan don gia gio da la vo ly).
 *   - `fixed_hourly` : 0 < so tien <= 10.000.000 d/gio.
 */
export const employeeOvertimeRateInputSchema = z
  .object({
    employeeId: z.string().min(1, "Vui lòng chọn nhân viên."),
    valueType: overtimeRateValueTypeSchema,
    value: z
      .number({ invalid_type_error: "Vui lòng nhập giá trị." })
      .positive("Giá trị phải lớn hơn 0."),
    effectiveFrom: z
      .string()
      .regex(DATE_PATTERN, "Vui lòng chọn ngày bắt đầu hiệu lực."),
  })
  .superRefine((input, ctx) => {
    if (input.valueType === "multiplier" && input.value > 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Hệ số tăng ca không vượt quá 10 lần đơn giá giờ.",
      });
    }
    if (input.valueType === "fixed_hourly" && input.value > 10_000_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Số tiền một giờ tăng ca quá lớn.",
      });
    }
  })
  .transform((input) => ({
    employee_id: input.employeeId,
    value_type: input.valueType,
    value: input.value,
    effective_from: input.effectiveFrom,
  }));
