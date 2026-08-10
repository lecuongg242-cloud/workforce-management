"use server";

import { cookies } from "next/headers";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import {
  ACTIVE_COMPANY_COOKIE,
  getActiveSupportSession,
} from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Vong doi mot phien ho tro (D-49).
 *
 * `SUPPORT_SESSION_MINUTES` la ha tang van hanh cua TimeFlow, KHONG phai quy
 * tac nghiep vu cua doanh nghiep khach — nen no la mot hang so trong ma nguon
 * va khong roi vao pham vi cong `no-hardcoded-work-rules` /
 * `no-hardcoded-money`. Khong co duong gia han: het gio thi mo phien moi, va
 * phien moi la mot dong nhat ky moi — do la tinh nang, khong phai phien ha.
 */

const SUPPORT_SESSION_MINUTES = 60;

const SESSION_COLUMNS = "id, company_id, expires_at";

interface SupportSessionRow {
  id: string;
  company_id: string;
  expires_at: string;
}

/** Do dai mot phien ho tro, tinh bang phut. */
export async function supportSessionMinutes(): Promise<number> {
  return SUPPORT_SESSION_MINUTES;
}

/**
 * Mo mot phien ho tro vao DUNG MOT doanh nghiep.
 *
 * Thu tu ghi: bang truoc, audit sau, cookie sau cung. Cookie la thu duy nhat
 * dat lai duoc neu buoc sau hong; hai buoc dau thi khong. Hong o giua nghia la
 * co mot dong `support_sessions` khong cookie — nguoi dung khong vao duoc,
 * nhung VET thi da co, va do la huong hong an toan hon.
 */
export async function openSupportSession(
  companyId: string,
  reason: string,
): Promise<void> {
  const { userId } = await requirePlatformAdmin();

  const trimmedReason = reason.trim();
  if (trimmedReason.length === 0) {
    throw new Error("Vui lòng nhập lý do mở phiên hỗ trợ.");
  }

  const supabase = await createServerSupabase();
  const openedAt = new Date();
  const expiresAt = new Date(
    openedAt.getTime() + SUPPORT_SESSION_MINUTES * 60_000,
  ).toISOString();

  const { data: inserted, error } = await supabase
    .from("support_sessions")
    .insert({
      platform_admin_id: userId,
      company_id: companyId,
      reason: trimmedReason,
      expires_at: expiresAt,
    })
    .select(SESSION_COLUMNS)
    .single();

  if (error || !inserted) {
    throw new Error("Không mở được phiên hỗ trợ.");
  }
  const row = inserted as SupportSessionRow;

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "access",
    entityTable: "support_sessions",
    entityId: row.id,
    before: null,
    after: { opened_at: openedAt.toISOString(), expires_at: row.expires_at },
    reason: `Mở phiên hỗ trợ: ${trimmedReason}`,
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Dong phien dang mo. Sau ham nay `tf_has_support_access()` tra `false` NGAY
 * o request ke tiep — khong doi het han, khong cache nao o giua.
 */
export async function closeSupportSession(): Promise<void> {
  const { userId } = await requirePlatformAdmin();

  const active = await getActiveSupportSession();
  const cookieStore = await cookies();

  if (!active) {
    // Khong con phien nao: van xoa cookie, de trang thai giao dien khong ke
    // mot cau chuyen khac voi database.
    cookieStore.delete(ACTIVE_COMPANY_COOKIE);
    return;
  }

  const supabase = await createServerSupabase();
  const closedAt = new Date().toISOString();

  // THU TU BAT BUOC: ghi audit TRUOC, dat `closed_at` SAU.
  //
  // Policy `audit_log_insert_support` (0033) doi `tf_has_support_access()` —
  // ma ham do tra `false` NGAY khi `closed_at` duoc dat. Dat truoc roi ghi
  // sau nghia la dong audit cua viec dong phien KHONG BAO GIO ghi duoc, va
  // moi phien chi con mot nua vet. Loi nay do chinh test tich hop cua plan
  // nay bat duoc, khong phai suy dien.
  //
  // Huong hong con lai da duoc can nhac va chap nhan, cung ly le voi 05-01
  // ("lich su truoc, cap nhat sau"): hong o giua thi co mot dong audit noi
  // phien da dong trong khi no van mo — nguoi doc nhat ky thay thua mot dong,
  // con huong nguoc lai thi mot thao tac that bien mat khong dau vet.
  await logMutation({
    companyId: active.companyId,
    actorUserId: userId,
    action: "access",
    entityTable: "support_sessions",
    entityId: active.id,
    before: null,
    after: { closed_at: closedAt },
    reason: "Đóng phiên hỗ trợ",
  });

  const { error } = await supabase
    .from("support_sessions")
    .update({ closed_at: closedAt })
    .eq("id", active.id);

  if (error) {
    throw new Error("Không đóng được phiên hỗ trợ.");
  }

  cookieStore.delete(ACTIVE_COMPANY_COOKIE);
}
