"use server";

import { cookies } from "next/headers";

import {
  ACTIVE_COMPANY_COOKIE,
  ForbiddenError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";

const ACTIVE_COMPANY_MAX_AGE = 60 * 60 * 24 * 30; // 30 ngay

/**
 * Chon doanh nghiep hien hanh. Lay MOI dinh danh tu `getSessionContext()`,
 * khong bao gio tu tham so client gui len (ngoai `companyId` von luon duoc
 * xac minh lai voi `memberships` truoc khi dung — D-12b).
 */
export async function selectCompanyAction(companyId: string): Promise<void> {
  const { userId } = await getSessionContext();
  const supabase = await createServerSupabase();

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id, user_id, company_id, role, status, last_accessed_at")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !membership) {
    // companyId khong thuoc membership active nao cua nguoi nay -- tu choi,
    // KHONG dat cookie.
    throw new ForbiddenError();
  }

  const before = { ...membership };
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("memberships")
    .update({ last_accessed_at: now })
    .eq("id", membership.id)
    .select("id, user_id, company_id, role, status, last_accessed_at")
    .single();

  if (updateError || !updated) {
    throw new Error("Không thể chọn doanh nghiệp.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_COMPANY_MAX_AGE,
  });

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "memberships",
    entityId: membership.id,
    before,
    after: updated,
    reason: null,
  });
}
