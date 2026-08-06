"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  payAdjustmentInputSchema,
  payAdjustmentRowSchema,
} from "@/lib/validation/api/pay-adjustments";
import type { PayAdjustment, PayAdjustmentInput } from "@/lib/types/domain";

/**
 * Duong GHI DUY NHAT cua `pay_adjustments` va `pay_adjustment_scopes`
 * (PAY-04, plan 05-2-03). Ba thao tac: tao, sua, va TAT.
 *
 * KHONG CO HAM XOA, va do khong phai su so sot (prohibition cua plan).
 * Mot khoan da tung vao mot ban chot luong ma bi xoa thi ban chot cua ky DA
 * TRA mat phan giai thich "vi sao ra con so do" — va do la thu duy nhat tra
 * loi duoc cau hoi ay sau nay. `deactivatePayAdjustment()` tat khoan; du lieu
 * o lai.
 *
 * PHAM VI LA MOT TAP, KHONG PHAI MOT CHUOI LICH SU. Vi vay `updatePayAdjustment`
 * XOA het pham vi cu roi ghi lai danh sach moi. Phep `.delete()` duy nhat cua
 * file nay nam o do — no xoa `pay_adjustment_scopes`, khong bao gio xoa
 * `pay_adjustments`.
 *
 * PLAN NAY KHONG TINH MOT CON SO TIEN NAO. `percent_of_daily_wage` chi la mot
 * cach khai gia tri; quy no ra tien la viec cua 05-2-04.
 */

const ADJUSTMENT_COLUMNS =
  "id, company_id, name, kind, value_type, value, basis, is_active, created_at";
const SCOPE_COLUMNS = "id, company_id, adjustment_id, mode, scope_type, scope_value";
const ADJUSTMENT_WITH_SCOPES = `${ADJUSTMENT_COLUMNS}, pay_adjustment_scopes(${SCOPE_COLUMNS})`;

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Doc lai nguyen khoan kem pham vi — dung cho ca `before` lan `after` cua audit. */
async function readAdjustment(
  supabase: Supabase,
  companyId: string,
  adjustmentId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("pay_adjustments")
    .select(ADJUSTMENT_WITH_SCOPES)
    .eq("company_id", companyId)
    .eq("id", adjustmentId)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/** Ghi lai TOAN BO tap pham vi cua mot khoan: xoa tap cu, chen tap moi. */
async function replaceScopes(
  supabase: Supabase,
  {
    companyId,
    adjustmentId,
    scopes,
  }: {
    companyId: string;
    adjustmentId: string;
    scopes: Array<{
      mode: "include" | "exclude";
      scope_type: string;
      scope_value: string | null;
    }>;
  },
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("pay_adjustment_scopes")
    .delete()
    .eq("company_id", companyId)
    .eq("adjustment_id", adjustmentId);
  if (deleteError) {
    throw new Error("Không thể cập nhật phạm vi áp dụng của khoản.");
  }

  if (scopes.length === 0) return;

  const { error: insertError } = await supabase.from("pay_adjustment_scopes").insert(
    scopes.map((scope) => ({
      company_id: companyId,
      adjustment_id: adjustmentId,
      ...scope,
    })),
  );
  if (insertError) {
    throw new Error("Không thể lưu phạm vi áp dụng của khoản.");
  }
}

export async function createPayAdjustment(
  input: PayAdjustmentInput,
): Promise<PayAdjustment> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const parsed = payAdjustmentInputSchema.parse(input);
  const supabase = await createServerSupabase();

  const { data: inserted, error } = await supabase
    .from("pay_adjustments")
    .insert({ company_id: companyId, ...parsed.row })
    .select(ADJUSTMENT_COLUMNS)
    .single();

  if (error || !inserted) {
    throw new Error("Không thể tạo khoản.");
  }

  const adjustmentId = (inserted as { id: string }).id;
  await replaceScopes(supabase, {
    companyId,
    adjustmentId,
    scopes: parsed.scopes,
  });

  const after = await readAdjustment(supabase, companyId, adjustmentId);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "pay_adjustments",
    entityId: adjustmentId,
    before: null,
    after,
    reason: null,
  });

  return payAdjustmentRowSchema.parse(after);
}

export async function updatePayAdjustment(
  adjustmentId: string,
  input: PayAdjustmentInput,
): Promise<PayAdjustment> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const parsed = payAdjustmentInputSchema.parse(input);
  const supabase = await createServerSupabase();

  // Doc nguyen dong TRUOC (D-18) — va cung la phep kiem "khoan nay co thuoc
  // doanh nghiep cua phien khong". Mot `id` cua doanh nghiep khac khong lot
  // qua `.eq("company_id", ...)` nen tra `null`, va KHONG dong nao bi doi.
  const before = await readAdjustment(supabase, companyId, adjustmentId);
  if (!before) {
    throw new Error("Không tìm thấy khoản.");
  }

  const { error } = await supabase
    .from("pay_adjustments")
    .update(parsed.row)
    .eq("company_id", companyId)
    .eq("id", adjustmentId);

  if (error) {
    throw new Error("Không thể cập nhật khoản.");
  }

  await replaceScopes(supabase, {
    companyId,
    adjustmentId,
    scopes: parsed.scopes,
  });

  const after = await readAdjustment(supabase, companyId, adjustmentId);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "pay_adjustments",
    entityId: adjustmentId,
    before,
    after,
    reason: null,
  });

  return payAdjustmentRowSchema.parse(after);
}

/**
 * TAT mot khoan. Day la thu thay the cho mot duong xoa — xem khoi comment dau
 * file ve vi sao khong co duong xoa.
 */
export async function deactivatePayAdjustment(
  adjustmentId: string,
  isActive: boolean,
): Promise<PayAdjustment> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  const before = await readAdjustment(supabase, companyId, adjustmentId);
  if (!before) {
    throw new Error("Không tìm thấy khoản.");
  }

  const { error } = await supabase
    .from("pay_adjustments")
    .update({ is_active: isActive })
    .eq("company_id", companyId)
    .eq("id", adjustmentId);

  if (error) {
    throw new Error("Không thể đổi trạng thái khoản.");
  }

  const after = await readAdjustment(supabase, companyId, adjustmentId);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "pay_adjustments",
    entityId: adjustmentId,
    before,
    after,
    reason: null,
  });

  return payAdjustmentRowSchema.parse(after);
}
