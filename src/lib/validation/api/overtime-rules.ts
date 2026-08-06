import { z } from "zod";

/**
 * Schema Zod cho he so tang ca (SET-03, plan 04-04).
 *
 * KHONG CO `.default()` O BAT KY TRUONG NAO, va day khong phai su so sot:
 * mot he so mac dinh — ke ca 1.5/2.0/3.0 theo luat lao dong — lam man hinh
 * trong nhu da tinh dung trong khi doanh nghiep chua khai gi (D-26). Doanh
 * nghiep phai tu khai, va cho nao chua khai thi he thong noi thang la chua
 * khai.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Bon loai ngay, khop dung rang buoc CHECK cua migration 0005. */
export const OVERTIME_RULE_KEYS = [
  "weekday",
  "weekend",
  "holiday",
  "night",
] as const;

export const overtimeRuleKeySchema = z.enum(OVERTIME_RULE_KEYS);

export const overtimeRuleRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    rule_key: overtimeRuleKeySchema,
    multiplier: z.coerce.number(),
    effective_from: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    ruleKey: row.rule_key,
    multiplier: row.multiplier,
    effectiveFrom: row.effective_from,
  }));

export const overtimeRuleSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  ruleKey: overtimeRuleKeySchema,
  multiplier: z.number(),
  effectiveFrom: z.string(),
});

/**
 * Mot khoa kem he so DANG HIEU LUC hom nay (`null` khi chua khai) va TOAN BO
 * lich su phien ban cua no, moi nhat truoc.
 */
export const overtimeRuleGroupSchema = z.object({
  ruleKey: overtimeRuleKeySchema,
  currentMultiplier: z.number().nullable(),
  currentEffectiveFrom: z.string().nullable(),
  versions: z.array(overtimeRuleSchema),
});

export const overtimeRuleListResponseSchema = z.array(overtimeRuleGroupSchema);

/**
 * Dau vao GHI — luon la MOT PHIEN BAN MOI (append-only, D-25), khong bao gio
 * la mot phep sua de. Khong khai truong dinh danh doanh nghiep nao (D-12b).
 */
export const overtimeRuleInputSchema = z
  .object({
    ruleKey: overtimeRuleKeySchema,
    multiplier: z
      .number({ invalid_type_error: "Vui lòng nhập hệ số tăng ca." })
      .positive("Hệ số tăng ca phải lớn hơn 0.")
      .max(99.99, "Hệ số tăng ca quá lớn."),
    effectiveFrom: z
      .string()
      .regex(DATE_PATTERN, "Vui lòng chọn ngày bắt đầu hiệu lực."),
  })
  .transform((input) => ({
    rule_key: input.ruleKey,
    multiplier: input.multiplier,
    effective_from: input.effectiveFrom,
  }));
