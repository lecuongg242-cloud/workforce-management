import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  canReadCompanyData,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  payRateHistorySchema,
  payRateQuerySchema,
  payRateRowSchema,
} from "@/lib/validation/api/pay-rates";

/**
 * Lich su muc luong cua MOT nhan vien (PAY-06, plan 05-2-01). Khuon 02-04
 * (D-12c): chi xuat `dynamic` va `GET`. Duong GHI la Server Action
 * `createPayRate` (`src/lib/data/mutations/pay-rates.ts`).
 *
 * CHI `owner`/`admin` (D-44). Vai tro khac nhan 403 KE CA KHI HOI CHINH MINH:
 * nhan vien chua xem duoc luong cua minh o phase nay (PAY-05 van o V3), va mot
 * ngoai le "tru khi hoi chinh minh" o day se la duong tat dau tien cho mot man
 * hinh phieu luong chua duoc thiet ke.
 *
 * Khac voi `/api/overtime-rules`, day KHONG tra ve mot the "chua khai" cho moi
 * nguoi khi phien khong hop le — no tra loi that. Ly do: mot lich su luong
 * rong tra ve cho nguoi khong co quyen se doc ra thanh "nguoi nay chua duoc
 * khai luong", tuc la mot cau tra loi ve du lieu ma ho khong duoc phep hoi.
 */
export const dynamic = "force-dynamic";

const PAY_RATE_COLUMNS =
  "id, company_id, employee_id, unit, amount, effective_from, created_at, created_by";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId, role } = await getSessionContext();
    if (!canReadCompanyData(role)) throw new ForbiddenError();

    const url = new URL(request.url);
    const parsedQuery = payRateQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Thiếu tham số nhân viên." },
        { status: 400 },
      );
    }
    const { employeeId } = parsedQuery.data;

    const supabase = await createServerSupabase();

    // "Hom nay" theo dong ho SERVER (D-19) — muc luong DANG HIEU LUC phai duoc
    // xac dinh theo ngay cua may chu, khong theo dong ho may nguoi dung.
    const { data: serverNow, error: nowError } = await supabase.rpc("tf_server_now");
    if (nowError || !serverNow) {
      throw new Error("Không đọc được thời gian máy chủ.");
    }
    const { data: today, error: todayError } = await supabase.rpc("tf_work_date", {
      p_instant: serverNow as string,
    });
    if (todayError || !today) {
      throw new Error("Không xác định được ngày hiện tại.");
    }

    // `.eq("company_id", companyId)` tu PHIEN (D-12b): mot `employeeId` cua
    // doanh nghiep khac cho ra lich su rong, khong phai du lieu cua ho.
    const { data, error } = await supabase
      .from("employee_pay_rates")
      .select(PAY_RATE_COLUMNS)
      .eq("company_id", companyId)
      .eq("employee_id", employeeId)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("Không thể tải lịch sử mức lương.");
    }

    const versions = ((data ?? []) as unknown[]).map((row) =>
      payRateRowSchema.parse(row),
    );

    // Phien ban DANG HIEU LUC: effective_from lon nhat ma van <= hom nay. Ngay
    // hom nay nam TRUOC moi phien ban -> `null`, KHONG lui ve phien ban gan
    // nhat va khong bia ra 0 — cung mot quy tac voi `tf_pay_rate_at()` cua
    // migration 0022.
    const current =
      versions.find((version) => version.effectiveFrom <= (today as string)) ?? null;

    return NextResponse.json(
      payRateHistorySchema.parse({ employeeId, current, versions }),
    );
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
    console.error("Lỗi không xác định ở GET /api/pay-rates:", cause);
    return NextResponse.json(
      { error: "Không thể tải lịch sử mức lương." },
      { status: 500 },
    );
  }
}
