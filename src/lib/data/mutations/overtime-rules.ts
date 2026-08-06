"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  overtimeRuleInputSchema,
  overtimeRuleRowSchema,
} from "@/lib/validation/api/overtime-rules";
import type { OvertimeRule, OvertimeRuleInput } from "@/lib/types/domain";

/**
 * Duong GHI DUY NHAT cua `overtime_rules`, va no CHI CHEN.
 *
 * Bang nay la APPEND-ONLY (D-25): sua mot he so nghia la khai MOT PHIEN BAN
 * MOI voi `effective_from`, khong bao gio UPDATE hay DELETE dong cu. Do la co
 * che duy nhat lam cho tieu chi 4 cua Phase 4 — "sua quy tac hom nay khong
 * doi phan loai cua ban ghi hom qua" — thanh su that kiem chung duoc.
 *
 * Neu mot ngay nao do ai do quen quy uoc nay va viet `.update()` o day,
 * trigger `overtime_rules_append_only` (migration 0016) se chan lai o tang
 * database — do la ly do trigger ton tai (D-25a).
 */

const OVERTIME_RULE_COLUMNS = "id, company_id, rule_key, multiplier, effective_from";

/** Ma loi Postgres cho vi pham rang buoc unique. */
const UNIQUE_VIOLATION = "23505";

export async function createOvertimeRuleVersion(
  input: OvertimeRuleInput,
): Promise<OvertimeRule> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const writeRow = overtimeRuleInputSchema.parse(input);
  const supabase = await createServerSupabase();

  const { data: inserted, error } = await supabase
    .from("overtime_rules")
    .insert({ company_id: companyId, ...writeRow })
    .select(OVERTIME_RULE_COLUMNS)
    .single();

  if (error || !inserted) {
    if (error?.code === UNIQUE_VIOLATION) {
      throw new Error(
        `Đã có một phiên bản hệ số của loại ngày này bắt đầu hiệu lực từ ${writeRow.effective_from}. Hãy chọn một ngày hiệu lực khác.`,
      );
    }
    throw new Error("Không thể khai hệ số tăng ca.");
  }

  const rule = overtimeRuleRowSchema.parse(inserted);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "overtime_rules",
    entityId: rule.id,
    before: null,
    after: inserted,
    reason: null,
  });

  return rule;
}
