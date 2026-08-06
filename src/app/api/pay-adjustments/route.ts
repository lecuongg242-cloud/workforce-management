import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  requireRole,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  payAdjustmentListResponseSchema,
  payAdjustmentRowSchema,
} from "@/lib/validation/api/pay-adjustments";

/**
 * Danh muc phu cap / khau tru cua doanh nghiep, KEM pham vi cua tung khoan
 * (PAY-04, plan 05-2-03). Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`.
 * Duong GHI la ba Server Action o `src/lib/data/mutations/pay-adjustments.ts`.
 *
 * CHI `owner`/`admin`. Danh muc nay khong chua so tien cua ai ca, nhung tu no
 * suy ra duoc chinh sach luong cua doanh nghiep va ai duoc huong khoan nao —
 * du de mot nhan vien doc ra thu ho khong duoc phep hoi.
 *
 * Khoan DANG BAT truoc, roi den khoan da tat; trong moi nhom sap theo ngay
 * tao. Khoan da tat khong bi loai khoi phan hoi: no van la mot phan cua chinh
 * sach, va man hinh phai hien duoc no de bat lai.
 */
export const dynamic = "force-dynamic";

const ADJUSTMENT_COLUMNS =
  "id, company_id, name, kind, value_type, value, basis, is_active, created_at";
const SCOPE_COLUMNS = "id, company_id, adjustment_id, mode, scope_type, scope_value";

export async function GET(): Promise<NextResponse> {
  try {
    const { companyId, role } = await getSessionContext();
    requireRole(role, ["owner", "admin"]);

    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from("pay_adjustments")
      .select(`${ADJUSTMENT_COLUMNS}, pay_adjustment_scopes(${SCOPE_COLUMNS})`)
      .eq("company_id", companyId)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error("Không thể tải danh mục phụ cấp và khấu trừ.");
    }

    const adjustments = ((data ?? []) as unknown[]).map((row) =>
      payAdjustmentRowSchema.parse(row),
    );

    return NextResponse.json(payAdjustmentListResponseSchema.parse(adjustments));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    console.error("Lỗi không xác định ở GET /api/pay-adjustments:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh mục phụ cấp và khấu trừ." },
      { status: 500 },
    );
  }
}
