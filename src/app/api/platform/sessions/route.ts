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

// KHONG export: Next.js chi cho phep mot tap export co dinh tren Route
// Handler (GET/POST/dynamic/...) va bat ky export nao khac deu lam
// `.next/types` khong hop le — loi chi lo ra sau khi `next dev` sinh kieu
// cho route nay, khong lo ra o lan typecheck trong.
const SUPPORT_LOG_LIMIT = 200;

interface SupportSessionRow {
  id: string;
  company_id: string;
  reason: string;
  opened_at: string;
  expires_at: string;
  closed_at: string | null;
}

/**
 * Ban do ma doanh nghiep -> ten, lay tu RPC tong hop.
 *
 * KHONG dung `.select("…, companies(name)")`: phep join do di qua RLS cua
 * bang `companies`, ma quyen doc bang do cua platform admin lai den tu CHINH
 * phien ho tro. He qua — do mot lan bam tay bat duoc — la nhat ky hien ten
 * doanh nghiep khi phien con mo, roi tut ve ma tho `cty-01` ngay khi dong
 * phien. Tuc la MOI dong lich su deu mat ten, dung luc nhat ky can doc lai
 * nhat.
 *
 * `tf_platform_company_overview()` (0035) tra ten cho platform admin ma
 * khong doi phien nao — no chi tra so tong hop nen duoc phep vay (D-56).
 */
async function loadCompanyNames(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc("tf_platform_company_overview");
  if (error) return new Map();
  const rows = (data ?? []) as Array<{
    company_id: string;
    company_name: string;
  }>;
  return new Map(rows.map((row) => [row.company_id, row.company_name]));
}

export async function GET(): Promise<NextResponse> {
  try {
    await requirePlatformAdmin();

    const supabase = await createServerSupabase();

    const [{ data, error }, companyNames] = await Promise.all([
      supabase
        .from("support_sessions")
        .select("id, company_id, reason, opened_at, expires_at, closed_at")
        .order("opened_at", { ascending: false })
        .limit(SUPPORT_LOG_LIMIT),
      loadCompanyNames(supabase),
    ]);

    if (error) {
      throw new Error("Không thể tải nhật ký phiên hỗ trợ.");
    }

    const rows = (data ?? []) as SupportSessionRow[];
    const parsed = supportSessionLogResponseSchema.parse(
      rows.map((row) => ({
        id: row.id,
        companyId: row.company_id,
        // `?? company_id` chi la luoi cuoi: doanh nghiep bi xoa thi FK
        // `on delete cascade` cung xoa dong nay, nen tren thuc te khong roi
        // vao nhanh do.
        companyName: companyNames.get(row.company_id) ?? row.company_id,
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
