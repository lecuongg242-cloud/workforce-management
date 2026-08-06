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
  requestEffectPlainSchema,
  requestEffectRowSchema,
} from "@/lib/validation/api/requests";

/**
 * Xem TRUOC tac dong cua mot yeu cau len du lieu cong (plan 05-02 Task 3).
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`.
 *
 * Chi `owner`/`admin` doc duoc: day la con so phuc vu QUYET DINH DUYET, va chi
 * hai vai tro do duyet (D-30).
 *
 * Con so do SERVER dem, khong do giao dien suy ra — cung ly do voi
 * `countAffectedAttendance()` cua 04-03: client khong co du lieu de biet ngay
 * nao la ngay lam viec, ngay nao la ngay le, ngay nao da co cham cong.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const { companyId, role } = await getSessionContext();
    requireRole(role, ["owner", "admin"]);

    const supabase = await createServerSupabase();

    // Ranh gioi doanh nghiep kiem o day chu khong trong ham SQL: ham chay
    // `security invoker` nen RLS da chan, nhung mot lan kiem tuong minh cho
    // phep tra dung thong diep thay vi mot loi RPC tho.
    const { data: requestRow, error: requestError } = await supabase
      .from("work_requests")
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (requestError || !requestRow) {
      return NextResponse.json(
        { error: "Không tìm thấy yêu cầu." },
        { status: 404 },
      );
    }

    const { data, error } = await supabase.rpc("tf_preview_request_effect", {
      p_request_id: id,
    });

    if (error || !data) {
      return NextResponse.json(
        { error: "Không tính được tác động của yêu cầu này." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      requestEffectPlainSchema.parse(requestEffectRowSchema.parse(data)),
    );
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      return NextResponse.json({ error: "Không tìm thấy yêu cầu." }, { status: 404 });
    }
    console.error("Lỗi không xác định ở GET /api/requests/[id]/effect:", cause);
    return NextResponse.json(
      { error: "Không tính được tác động của yêu cầu này." },
      { status: 500 },
    );
  }
}
