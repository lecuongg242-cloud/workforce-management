import { createServerSupabase } from "@/lib/supabase/server";
import { companySettingsRowSchema } from "@/lib/validation/api/settings";
import type { CompanySettings } from "@/lib/types/domain";

/**
 * Doc cau hinh cua mot doanh nghiep O PHIA SERVER — dung boi Route Handler
 * (`GET /api/settings`), boi Server Action ghi cham cong, va boi danh sach
 * "Can xem lai". Day la NGUON DUY NHAT cua phep doc nay: khong noi nao duoc
 * tu viet mot truy van `from("company_settings")` thu hai, vi khi ay hai noi
 * se xu ly truong hop "chua co dong cau hinh" theo hai kieu khac nhau.
 *
 * Vi sao module rieng chu khong nam trong `src/lib/data/settings.ts`: file do
 * duoc component client import (qua `useDataQuery`), ma `createServerSupabase()`
 * doc `next/headers` nen khong ton tai o phia client.
 *
 * KHONG tra `null` khi thieu dong cau hinh (migration 0015 da backfill nen
 * dieu do khong nen xay ra, nhung doanh nghiep tao giua hai lan deploy thi
 * co the): tao dong mac dinh roi tra ve. Neu tra `null`, moi noi goi se tu
 * nghi ra mot gia tri thay the va hai man hinh se noi hai con so khac nhau
 * ve cung mot doanh nghiep.
 */

const COMPANY_SETTINGS_COLUMNS =
  "company_id, suspicious_distance_multiplier, shift_window_grace_minutes, night_start_time, night_end_time, updated_at, updated_by";

export async function loadCompanySettings(
  companyId: string,
): Promise<CompanySettings> {
  const supabase = await createServerSupabase();

  const { data: row, error } = await supabase
    .from("company_settings")
    .select(COMPANY_SETTINGS_COLUMNS)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error("Không thể tải cấu hình doanh nghiệp.");
  }
  if (row) {
    return companySettingsRowSchema.parse(row);
  }

  // Chua co dong nao — tao dong mac dinh (moi gia tri lay tu DEFAULT cua
  // migration 0015, khong lap lai con so nao o tang ung dung).
  const { data: created, error: insertError } = await supabase
    .from("company_settings")
    .insert({ company_id: companyId })
    .select(COMPANY_SETTINGS_COLUMNS)
    .single();

  if (insertError || !created) {
    throw new Error("Không thể khởi tạo cấu hình doanh nghiệp.");
  }
  return companySettingsRowSchema.parse(created);
}
