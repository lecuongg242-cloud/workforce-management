import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  canReadCompanyData,
  getSessionContext,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  requestReviewListResponseSchema,
  requestReviewRowSchema,
} from "@/lib/validation/api/requests";

/**
 * Lich su xu ly cua MOT yeu cau (APRV-04, plan 05-01). Khuon 02-04 (D-12c):
 * chi xuat `dynamic` va `GET`.
 *
 * PHAM VI DOC: `owner`/`admin` doc duoc lich su cua moi yeu cau trong doanh
 * nghiep minh. Vai tro con lai chi doc duoc lich su cua yeu cau CUA CHINH
 * MINH — mot dong lich su mang ly do tu choi, va ly do tu choi cua nguoi khac
 * khong phai chuyen cua ai ngoai nguoi do va nguoi duyet.
 *
 * Yeu cau khong thuoc doanh nghiep cua phien tra MANG RONG voi ma 200, khong
 * phai 404: hai truong hop "khong co lich su" va "yeu cau cua doanh nghiep
 * khac" phai khong phan biet duoc tu ben ngoai (cung ly do voi
 * `GET /api/employees/[id]`, T-02-07-01).
 *
 * Embed `employees(full_name)` o day KHONG mo ho: `request_reviews` chi co
 * DUNG MOT khoa ngoai tro toi `employees` (`reviewer_employee_id`) — khac
 * `work_requests` (co hai) nen bang do phai truy van hai buoc.
 */
export const dynamic = "force-dynamic";

const REVIEW_COLUMNS =
  "id, company_id, request_id, decision, note, reviewer_user_id, reviewer_employee_id, created_at, employees(full_name)";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const { companyId, role, employeeId: sessionEmployeeId } =
      await getSessionContext();

    const supabase = await createServerSupabase();

    // Doc chinh dong yeu cau TRUOC de biet no thuoc ai — pham vi doc cua vai
    // tro khong phai quan tri phu thuoc vao dieu do, va khong the suy ra tu
    // bang lich su.
    const { data: requestRow, error: requestError } = await supabase
      .from("work_requests")
      .select("id, employee_id")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (requestError) {
      return NextResponse.json(
        { error: "Không thể tải lịch sử xử lý." },
        { status: 500 },
      );
    }
    if (!requestRow) {
      return NextResponse.json(requestReviewListResponseSchema.parse([]));
    }

    const isAdminRole = canReadCompanyData(role);
    if (!isAdminRole && requestRow.employee_id !== sessionEmployeeId) {
      throw new ForbiddenError();
    }

    const { data, error } = await supabase
      .from("request_reviews")
      .select(REVIEW_COLUMNS)
      .eq("company_id", companyId)
      .eq("request_id", id)
      // Moi nhat truoc; `id` lam tiebreaker de hai lan goi cho cung thu tu
      // ngay ca khi hai lan xu ly roi vao cung mot dau thoi gian.
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Không thể tải lịch sử xử lý." },
        { status: 500 },
      );
    }

    const items = ((data ?? []) as unknown[]).map((row) =>
      requestReviewRowSchema.parse(row),
    );
    return NextResponse.json(requestReviewListResponseSchema.parse(items));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      return NextResponse.json(requestReviewListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/requests/[id]/reviews:", cause);
    return NextResponse.json(
      { error: "Không thể tải lịch sử xử lý." },
      { status: 500 },
    );
  }
}
