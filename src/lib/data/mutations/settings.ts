"use server";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  companySettingsInputSchema,
  companySettingsRowSchema,
} from "@/lib/validation/api/settings";
import type { CompanySettings, CompanySettingsInput } from "@/lib/types/domain";

/**
 * Duong GHI DUY NHAT vao `company_settings`. Ba plan sau cua Phase 4 them cot
 * thi them vao ham nay, KHONG mo mot duong ghi thu hai: cau hinh la thu dieu
 * khien cach toan bo du lieu cong duoc phan loai, hai bo quy tac kiem tra
 * song song se lech nhau va khong ai biet ben nao dung.
 *
 * Khuon `mutations/work-sites.ts` (03-02): `getSessionContext()` ->
 * `requireRole` -> doc nguyen dong TRUOC -> ghi voi `.eq("company_id", companyId)`
 * (companyId LUON tu phien, khong bao gio tu tham so — D-12b) -> doc nguyen
 * dong SAU -> `logMutation` ngay trong cung ham (D-17), before/after la
 * nguyen dong (D-18).
 */

const COMPANY_SETTINGS_COLUMNS =
  "company_id, suspicious_distance_multiplier, shift_window_grace_minutes, night_start_time, night_end_time, overtime_cap_hours_per_month, updated_at, updated_by";

export async function updateCompanySettings(
  patch: CompanySettingsInput,
): Promise<CompanySettings> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const parsedPatch = companySettingsInputSchema.parse(patch);

  const supabase = await createServerSupabase();

  const { data: beforeRow, error: beforeError } = await supabase
    .from("company_settings")
    .select(COMPANY_SETTINGS_COLUMNS)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRow) {
    throw new Error("Không tìm thấy cấu hình của doanh nghiệp.");
  }
  const before = companySettingsRowSchema.parse(beforeRow);

  // Hop nhat `{...current, ...patch}` bang "in" (khong phai "??") de truong CO
  // mat trong patch — ke ca gia tri 0 — luon duoc ap dung, truong khong co mat
  // giu nguyen gia tri cu.
  const merged = {
    suspicious_distance_multiplier:
      "suspiciousDistanceMultiplier" in parsedPatch &&
      parsedPatch.suspiciousDistanceMultiplier !== undefined
        ? parsedPatch.suspiciousDistanceMultiplier
        : before.suspiciousDistanceMultiplier,
    shift_window_grace_minutes:
      "shiftWindowGraceMinutes" in parsedPatch &&
      parsedPatch.shiftWindowGraceMinutes !== undefined
        ? parsedPatch.shiftWindowGraceMinutes
        : before.shiftWindowGraceMinutes,
    night_start_time:
      parsedPatch.nightStartTime !== undefined
        ? parsedPatch.nightStartTime
        : before.nightStartTime,
    night_end_time:
      parsedPatch.nightEndTime !== undefined
        ? parsedPatch.nightEndTime
        : before.nightEndTime,
    // SET-05: `null` la mot GIA TRI duoc gui co chu dich (xoa tran = khong
    // gioi han), con `undefined` la "khong dong toi truong nay". Phep kiem
    // `!== undefined` phan biet dung hai truong hop do — mot `??` o day se
    // lang le bien "xoa tran" thanh "giu nguyen tran cu".
    overtime_cap_hours_per_month:
      parsedPatch.overtimeCapHoursPerMonth !== undefined
        ? parsedPatch.overtimeCapHoursPerMonth
        : before.overtimeCapHoursPerMonth,
  };

  // Rang buoc lien truong: chi kiem duoc SAU khi hop nhat, vi patch co the chi
  // mang mot trong hai moc. Database con mot lop CHECK nua — day la lop tra ve
  // thong diep doc duoc, khong phai lop bao dam.
  if (merged.night_start_time === merged.night_end_time) {
    throw new Error("Giờ bắt đầu và giờ kết thúc ca đêm không được trùng nhau.");
  }

  // `updated_at` KHONG duoc gui tu day: trigger `company_settings_touch_updated_at`
  // (migration 0015) dat no bang dong ho cua database. Gui mot dau thoi gian tu
  // tang ung dung la mo duong cho dong ho client di vao du lieu (D-19).
  const { data: afterRow, error: updateError } = await supabase
    .from("company_settings")
    .update({ ...merged, updated_by: userId })
    .eq("company_id", companyId)
    .select(COMPANY_SETTINGS_COLUMNS)
    .single();

  if (updateError || !afterRow) {
    throw new Error("Không thể cập nhật cấu hình doanh nghiệp.");
  }

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "company_settings",
    entityId: companyId,
    before: beforeRow,
    after: afterRow,
    reason: null,
  });

  return companySettingsRowSchema.parse(afterRow);
}
