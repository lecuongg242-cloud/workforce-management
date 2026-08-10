import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import {
  ForbiddenError,
  UnauthenticatedError,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import { supportSessionLogResponseSchema } from "@/lib/validation/api/platform";

/**
 * SADM-03: nhat ky moi phien ho tro da mo.
 *
 * `support_sessions` CHINH LA nhat ky (D-55) — khong co co che thu hai, va
 * khong co policy `delete` nen no khong xoa duoc. Route nay chi doc lai no.
 *
 * Gioi han 200 dong gan nhat. Con so bi cat duoc NOI RO tren man hinh
 * ("Hiển thị 200 phiên gần nhất") — mot bang bi cat am tham doc nhu mot bang
 * day du, va do la cach te nhat de mot nhat ky noi doi.
 */
export const dynamic = "force-dynamic";

export const SUPPORT_LOG_LIMIT = 200;

interface SupportSessionJoinRow {
  id: string;
  company_id: string;
  reason: string;
  opened_at: string;
  expires_at: string;
  closed_at: string | null;
  companies: { name: string } | null;
}

export async function GET(): Promise<NextResponse> {
  try {
    await requirePlatformAdmin();

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("support_sessions")
      .select("id, company_id, reason, opened_at, expires_at, closed_at, companies(name)")
      .order("opened_at", { ascending: false })
      .limit(SUPPORT_LOG_LIMIT);

    if (error) {
      throw new Error("Không thể tải nhật ký phiên hỗ trợ.");
    }

    const rows = (data ?? []) as unknown as SupportSessionJoinRow[];
    const parsed = supportSessionLogResponseSchema.parse(
      rows.map((row) => ({
        id: row.id,
        companyId: row.company_id,
        // Doanh nghiep da bi xoa thi FK `on delete cascade` cung xoa dong nay,
        // nen nhanh `?? company_id` chi la luoi cho truong hop join hut.
        companyName: row.companies?.name ?? row.company_id,
        reason: row.reason,
        openedAt: row.opened_at,
        expiresAt: row.expires_at,
        closedAt: row.closed_at,
      })),
    );
    return NextResponse.json(parsed);
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    console.error("Lỗi không xác định ở GET /api/platform/sessions:", cause);
    return NextResponse.json(
      { error: "Không thể tải nhật ký phiên hỗ trợ." },
      { status: 500 },
    );
  }
}
