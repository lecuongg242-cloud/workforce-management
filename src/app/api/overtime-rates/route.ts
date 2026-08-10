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
  employeeOvertimeRateHistorySchema,
  employeeOvertimeRateQuerySchema,
  employeeOvertimeRateRowSchema,
} from "@/lib/validation/api/overtime-rates";

/**
 * Lich su MUC TANG CA RIENG cua MOT nhan vien (migration 0026). Khuon 02-04
 * (D-12c): chi xuat `dynamic` va `GET`. Duong GHI la Server Action
 * `createEmployeeOvertimeRate`
 * (`src/lib/data/mutations/employee-overtime-rates.ts`).
 *
 * CHI `owner`/`admin` (D-44), cung ly do voi `/api/pay-rates`: day la du lieu
 * ve tien cua mot nguoi cu the.
 *
 * `current === null` nghia la nguoi do KHONG CO muc rieng — ho an theo he so
 * cua doanh nghiep. Do KHONG phai "tang ca bang 0".
 */
export const dynamic = "force-dynamic";

const OVERTIME_RATE_COLUMNS =
  "id, company_id, employee_id, value_type, value, effective_from, created_at, created_by";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId, role } = await getSessionContext();
    if (!canReadCompanyData(role)) throw new ForbiddenError();

    const url = new URL(request.url);
    const parsedQuery = employeeOvertimeRateQuerySchema.safeParse(
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

    // "Hom nay" theo dong ho SERVER (D-19) — muc DANG HIEU LUC phai duoc xac
    // dinh theo ngay cua may chu, khong theo dong ho may nguoi dung.
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
      .from("employee_overtime_rates")
      .select(OVERTIME_RATE_COLUMNS)
      .eq("company_id", companyId)
      .eq("employee_id", employeeId)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("Không thể tải lịch sử mức tăng ca riêng.");
    }

    const versions = ((data ?? []) as unknown[]).map((row) =>
      employeeOvertimeRateRowSchema.parse(row),
    );

    // Phien ban DANG HIEU LUC: effective_from lon nhat ma van <= hom nay. Ngay
    // hom nay nam TRUOC moi phien ban -> `null`, cung quy tac voi
    // `tf_employee_overtime_rate_at()` cua migration 0026.
    const current =
      versions.find((version) => version.effectiveFrom <= (today as string)) ?? null;

    return NextResponse.json(
      employeeOvertimeRateHistorySchema.parse({ employeeId, current, versions }),
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
    console.error("Lỗi không xác định ở GET /api/overtime-rates:", cause);
    return NextResponse.json(
      { error: "Không thể tải lịch sử mức tăng ca riêng." },
      { status: 500 },
    );
  }
}
