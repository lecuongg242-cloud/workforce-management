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
  holidayListResponseSchema,
  holidayQuerySchema,
  holidayRowSchema,
} from "@/lib/validation/api/holidays";

/**
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. Ba duong ghi la Server
 * Action o `src/lib/data/mutations/holidays.ts`.
 *
 * MOI vai tro dang nhap deu doc duoc: nhan vien can biet ngay nao doanh
 * nghiep minh nghi le. Gioi han owner/admin nam o duong GHI.
 *
 * Nam mac dinh lay tu DONG HO SERVER (`tf_server_now`), khong tu tham so
 * client va khong tu `new Date()` o tang ung dung (D-19).
 */
export const dynamic = "force-dynamic";

const HOLIDAY_COLUMNS = "id, company_id, holiday_date, name";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId } = await getSessionContext();

    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const parsedQuery = holidayQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Tham số truy vấn không hợp lệ." },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabase();

    let year = parsedQuery.data.year;
    if (year === undefined) {
      const { data: serverNow, error: nowError } = await supabase.rpc("tf_server_now");
      if (nowError || !serverNow) {
        throw new Error("Không đọc được thời gian máy chủ.");
      }
      // `tf_work_date` quy khoanh khac ve NGAY LICH theo gio Viet Nam — dung
      // lai chinh no thay vi tu cat chuoi ISO (chuoi ISO la UTC, cat tay se
      // sai nam trong 7 tieng dau nam moi).
      const { data: workDate, error: workDateError } = await supabase.rpc(
        "tf_work_date",
        { p_instant: serverNow as string },
      );
      if (workDateError || !workDate) {
        throw new Error("Không xác định được ngày hiện tại.");
      }
      year = Number((workDate as string).slice(0, 4));
    }

    const { data, error } = await supabase
      .from("holidays")
      .select(HOLIDAY_COLUMNS)
      .eq("company_id", companyId)
      .gte("holiday_date", `${year}-01-01`)
      .lte("holiday_date", `${year}-12-31`)
      .order("holiday_date", { ascending: true });

    if (error) {
      throw new Error("Không thể tải danh sách ngày nghỉ lễ.");
    }

    const holidays = ((data ?? []) as unknown[]).map((row) =>
      holidayRowSchema.parse(row),
    );
    return NextResponse.json(holidayListResponseSchema.parse(holidays));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon doanh nghiep nao -- danh sach rong la du lieu hop
      // le, khong phai loi (dong bo voi GET /api/work-sites).
      return NextResponse.json(holidayListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/holidays:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách ngày nghỉ lễ." },
      { status: 500 },
    );
  }
}
