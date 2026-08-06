import { z } from "zod";

/**
 * Schema Zod cho danh muc phu cap / khau tru (PAY-04, plan 05-2-03), theo dung
 * khuon `overtime-rules.ts` / `pay-rates.ts` (D-12d).
 *
 * KHONG TRUONG NAO KHAI DINH DANH DOANH NGHIEP (D-12b): `companyId` luon den
 * tu `getSessionContext()`.
 *
 * Rang buoc so va rang buoc lien truong o day KHOP DUNG rang buoc CHECK cua
 * `supabase/migrations/0023_pay_adjustments.sql`. Lop nay tra ve mot cau tieng
 * Viet doc duoc; lop bao dam van la database.
 */

export const PAY_ADJUSTMENT_KINDS = ["allowance", "deduction"] as const;
export const PAY_ADJUSTMENT_VALUE_TYPES = [
  "fixed_amount",
  "percent_of_daily_wage",
] as const;
export const PAY_ADJUSTMENT_BASES = ["per_period", "per_late"] as const;
export const PAY_ADJUSTMENT_SCOPE_TYPES = [
  "company",
  "department",
  "position",
  "employee",
] as const;

export const payAdjustmentKindSchema = z.enum(PAY_ADJUSTMENT_KINDS);
export const payAdjustmentValueTypeSchema = z.enum(PAY_ADJUSTMENT_VALUE_TYPES);
export const payAdjustmentBasisSchema = z.enum(PAY_ADJUSTMENT_BASES);
export const payAdjustmentScopeTypeSchema = z.enum(PAY_ADJUSTMENT_SCOPE_TYPES);

/* -------------------------------------------------------------------------- */
/* Dong THO tu Supabase                                                        */
/* -------------------------------------------------------------------------- */

export const payAdjustmentScopeRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    adjustment_id: z.string(),
    mode: z.enum(["include", "exclude"]),
    scope_type: payAdjustmentScopeTypeSchema,
    scope_value: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    adjustmentId: row.adjustment_id,
    mode: row.mode,
    scopeType: row.scope_type,
    scopeValue: row.scope_value,
  }));

export const payAdjustmentRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    name: z.string(),
    kind: payAdjustmentKindSchema,
    value_type: payAdjustmentValueTypeSchema,
    // `numeric` ve JS qua PostgREST co the la so hoac chuoi tuy driver.
    value: z.coerce.number(),
    basis: payAdjustmentBasisSchema,
    is_active: z.boolean(),
    created_at: z.string(),
    pay_adjustment_scopes: z.array(payAdjustmentScopeRowSchema).nullable().optional(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    kind: row.kind,
    valueType: row.value_type,
    value: row.value,
    basis: row.basis,
    isActive: row.is_active,
    createdAt: row.created_at,
    scopes: row.pay_adjustment_scopes ?? [],
  }));

/* -------------------------------------------------------------------------- */
/* Hinh dang cuoi cung — dung o CA HAI dau cho hop dong JSON                   */
/* -------------------------------------------------------------------------- */

export const payAdjustmentScopeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  adjustmentId: z.string(),
  mode: z.enum(["include", "exclude"]),
  scopeType: payAdjustmentScopeTypeSchema,
  scopeValue: z.string().nullable(),
});

export const payAdjustmentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  kind: payAdjustmentKindSchema,
  valueType: payAdjustmentValueTypeSchema,
  value: z.number(),
  basis: payAdjustmentBasisSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  scopes: z.array(payAdjustmentScopeSchema),
});

export const payAdjustmentListResponseSchema = z.array(payAdjustmentSchema);

/* -------------------------------------------------------------------------- */
/* Dau vao GHI                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * MOT dong pham vi trong dau vao ghi. `scopeValue` bat buoc co voi ba loai
 * khac `company`, va bat buoc VANG voi `company` — cung rang buoc CHECK cua
 * migration 0023, kiem o day de tra ve mot cau doc duoc.
 */
export const payAdjustmentScopeInputSchema = z
  .object({
    mode: z.enum(["include", "exclude"]),
    scopeType: payAdjustmentScopeTypeSchema,
    scopeValue: z.string().trim().nullable().optional(),
  })
  .superRefine((scope, ctx) => {
    const value = scope.scopeValue ?? null;
    if (scope.scopeType === "company") {
      if (value !== null && value !== "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scopeValue"],
          message: "Phạm vi toàn công ty không nhận giá trị cụ thể.",
        });
      }
      return;
    }
    if (value === null || value === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scopeValue"],
        message: "Vui lòng chọn giá trị cho phạm vi này.",
      });
    }
  })
  .transform((scope) => ({
    mode: scope.mode,
    scope_type: scope.scopeType,
    // Chuan hoa "" ve null de database nhan dung mot cach bieu dien cua
    // "khong co gia tri".
    scope_value:
      scope.scopeType === "company" ? null : (scope.scopeValue ?? null) || null,
  }));

export const payAdjustmentInputSchema = z
  .object({
    name: z.string().trim().min(1, "Vui lòng nhập tên khoản.").max(120, "Tên khoản quá dài."),
    kind: payAdjustmentKindSchema,
    valueType: payAdjustmentValueTypeSchema,
    value: z
      .number({ invalid_type_error: "Vui lòng nhập giá trị." })
      .positive("Giá trị phải lớn hơn 0.")
      .max(999999999999, "Giá trị quá lớn."),
    basis: payAdjustmentBasisSchema,
    isActive: z.boolean(),
    scopes: z.array(payAdjustmentScopeInputSchema),
  })
  .superRefine((input, ctx) => {
    // Phat di muon khong the la mot khoan CONG (D-41) — cung rang buoc CHECK
    // cua migration 0023.
    if (input.basis === "per_late" && input.kind !== "deduction") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["basis"],
        message: "Khoản tính theo số lần đi muộn phải là một khoản khấu trừ.",
      });
    }
    if (input.valueType === "percent_of_daily_wage" && input.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Phần trăm lương ngày không vượt quá 100.",
      });
    }
  })
  .transform((input) => ({
    row: {
      name: input.name,
      kind: input.kind,
      value_type: input.valueType,
      value: input.value,
      basis: input.basis,
      is_active: input.isActive,
    },
    scopes: input.scopes,
  }));
