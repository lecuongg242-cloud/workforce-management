"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  closePeriodInputSchema,
  periodRowSchema,
} from "@/lib/validation/api/periods";
import type { Period } from "@/lib/types/domain";

/**
 * Chot mot ky cong (PERD-01, plan 05-05).
 *
 * Toan bo phan quyet dinh nam trong `tf_close_period()` (migration 0021): tao
 * dong ky neu chua co, tu choi ky chua ket thuc, tu choi ky da chot. Tang nay
 * chi lam ba viec ma tang SQL khong lam duoc — kiem VAI TRO, doc dong TRUOC de
 * co `before` cho audit, va ghi `logMutation`.
 *
 * KHONG CO HAM NGUOC LAI trong file nay (D-32b). Chot ky la mot cua MOT CHIEU
 * o phase nay, co chu dich: mot nut "mo lai" lam rong nghia cua viec chot.
 */
export async function closePeriod(month: string): Promise<Period> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const { month: safeMonth } = closePeriodInputSchema.parse({ month });
  const startDate = `${safeMonth}-01`;

  const supabase = await createServerSupabase();

  // Dong TRUOC co the KHONG TON TAI (ky chua duoc tao lan nao) — do la truong
  // hop binh thuong, khong phai loi: `tf_close_period` se tao no.
  const { data: beforeRow } = await supabase
    .from("periods")
    .select("id, company_id, start_date, end_date, status, closed_at, closed_by")
    .eq("company_id", companyId)
    .eq("start_date", startDate)
    .maybeSingle();

  // `p_closed_by` chi duoc dung khi ham SQL khong thay `auth.uid()` (duong
  // dac quyen phia server). Voi mot phien nguoi dung that, `auth.uid()` thang
  // — nen tham so nay khong phai mot duong ghi ten nguoi khac vao vet.
  const { data: closedRow, error } = await supabase.rpc("tf_close_period", {
    p_company_id: companyId,
    p_start_date: startDate,
    p_closed_by: userId,
  });

  if (error || !closedRow) {
    // Thong diep cua ham SQL da noi ro ly do (chua ket thuc / da chot) bang
    // tieng Viet — chuyen nguyen van thay vi thay bang mot cau chung chung.
    throw new Error(error?.message ?? "Không chốt được kỳ công.");
  }

  const period = periodRowSchema.parse(closedRow);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "periods",
    entityId: period.id,
    before: beforeRow,
    after: closedRow,
    reason: `Chốt kỳ công tháng ${safeMonth}`,
  });

  return period;
}
