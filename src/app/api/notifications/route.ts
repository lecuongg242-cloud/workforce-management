import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  notificationFeedSchema,
  notificationRowSchema,
} from "@/lib/validation/api/notifications";

/**
 * Thong bao cua CHINH PHIEN (APRV-05, plan 05-04). Khuon 02-04 (D-12c): chi
 * xuat `dynamic` va `GET`.
 *
 * KHONG co tham so nao khai nguoi nhan. Pham vi den tu `getSessionContext()`
 * — cung ly do voi `companyId` (D-12b), nhung o day ranh gioi la CON NGUOI:
 * mot tham so `userId` nhan tu client se la duong duy nhat de doc thong bao
 * cua nguoi khac, va RLS cua 0020 se la thu duy nhat chan lai. Khong mo duong
 * do ngay tu dau thi khong can dua vao lop phong thu thu hai.
 *
 * MOI VAI TRO deu doc duoc thong bao cua chinh minh, ke ca `owner`: chu doanh
 * nghiep cung co the la nguoi gui yeu cau.
 */
export const dynamic = "force-dynamic";

const NOTIFICATION_COLUMNS =
  "id, company_id, user_id, kind, title, body, request_id, read_at, created_at";

/** Danh sach chi lay chung nay dong gan nhat — chuong khong phai mot kho luu tru. */
const FEED_LIMIT = 50;

export async function GET(): Promise<NextResponse> {
  try {
    const { companyId, userId } = await getSessionContext();

    const supabase = await createServerSupabase();

    const [listResult, countResult] = await Promise.all([
      supabase
        .from("notifications")
        .select(NOTIFICATION_COLUMNS)
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(FEED_LIMIT),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .is("read_at", null),
    ]);

    if (listResult.error || countResult.error) {
      return NextResponse.json(
        { error: "Không thể tải thông báo." },
        { status: 500 },
      );
    }

    const items = ((listResult.data ?? []) as unknown[]).map((row) =>
      notificationRowSchema.parse(row),
    );

    return NextResponse.json(
      notificationFeedSchema.parse({
        items,
        // So chua doc dem TREN TOAN BO bang, khong phai tren `items` — mot
        // nguoi co 60 thong bao chua doc van phai thay dung 60, khong phai 50.
        unreadCount: countResult.count ?? 0,
      }),
    );
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon duoc doanh nghiep nao -- danh sach rong la du lieu
      // hop le, khong phai loi (dong bo voi GET /api/requests).
      return NextResponse.json(
        notificationFeedSchema.parse({ items: [], unreadCount: 0 }),
      );
    }
    console.error("Lỗi không xác định ở GET /api/notifications:", cause);
    return NextResponse.json(
      { error: "Không thể tải thông báo." },
      { status: 500 },
    );
  }
}
