import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import {
  ForbiddenError,
  UnauthenticatedError,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  platformCompanyListResponseSchema,
  platformCompanyRowSchema,
} from "@/lib/validation/api/platform";

/**
 * SADM-01: danh sach toan bo doanh nghiep tren he thong, kem tinh trang co
 * ban cua tung noi.
 *
 * Duong doc DUY NHAT trong repo duoc phep nhin xuyen doanh nghiep ma khong
 * can mot phien ho tro — va no chi lam duoc vay vi RPC ben duoi chi tra ve SO
 * TONG HOP (D-56). Khong doc bang khoa service: cong
 * `src/__tests__/admin-client-scope.test.ts` KHONG duoc noi cho file nay.
 *
 * Chi xuat `dynamic` va `GET` (D-12c).
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    await requirePlatformAdmin();

    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("tf_platform_company_overview");

    if (error) {
      throw new Error("Không thể tải danh sách doanh nghiệp toàn hệ thống.");
    }

    const rows = (data ?? []) as unknown[];
    const parsed = platformCompanyListResponseSchema.parse(
      rows.map((row) => platformCompanyRowSchema.parse(row)),
    );
    return NextResponse.json(parsed);
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    console.error("Lỗi không xác định ở GET /api/platform/companies:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách doanh nghiệp toàn hệ thống." },
      { status: 500 },
    );
  }
}
