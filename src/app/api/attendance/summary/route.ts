import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
} from "@/lib/auth/session-context";
import { shiftMonth } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  attendanceSummaryQuerySchema,
  monthlySummarySchema,
} from "@/lib/validation/api/attendance";

/**
 * Khuon 02-04 (D-12c): chi xuat `dynamic` va `GET`. Tra `MonthlySummary`
 * tinh tu tap ban ghi chuan cong trong thang o tang ung dung (quy mo du an
 * chua can toi uu bang mot RPC tong hop, xem CLAUDE.md §Constraints). Thang
 * khong co ban ghi tra ve ban tong hop TOAN SO 0 voi `month` dung bang tham
 * so — khong tra `null`, khong tra loi (edge DATA-05 empty).
 *
 * Lop quyen (AUTH-03): vai tro `employee`/`manager` hoi `employeeId` khac
 * cua chinh phien bi tu choi (403).
 */
export const dynamic = "force-dynamic";

interface RawSummaryRow {
  worked_minutes: number;
  status: string;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { companyId, role, employeeId: sessionEmployeeId } =
      await getSessionContext();

    const url = new URL(request.url);
    const rawQuery = Object.fromEntries(url.searchParams.entries());
    const queryParams = attendanceSummaryQuerySchema.parse(rawQuery);

    const isAdminRole = role === "owner" || role === "admin";
    if (!isAdminRole && queryParams.employeeId !== sessionEmployeeId) {
      throw new ForbiddenError();
    }

    const supabase = await createServerSupabase();
    const start = `${queryParams.month}-01`;
    const end = `${shiftMonth(queryParams.month, 1)}-01`;

    const { data, error } = await supabase
      .from("attendance_records")
      .select("worked_minutes, status")
      .eq("company_id", companyId)
      .eq("employee_id", queryParams.employeeId)
      .gte("work_date", start)
      .lt("work_date", end);

    if (error) {
      return NextResponse.json(
        { error: "Không thể tải tổng hợp công tháng." },
        { status: 500 },
      );
    }

    const records = (data ?? []) as RawSummaryRow[];
    const summary = {
      month: queryParams.month,
      workedDays: records.filter((record) => record.worked_minutes > 0).length,
      totalMinutes: records.reduce((sum, record) => sum + record.worked_minutes, 0),
      lateCount: records.filter((record) => record.status === "late").length,
      leaveDays: records.filter(
        (record) => record.status === "leave_paid" || record.status === "leave_unpaid",
      ).length,
    };

    return NextResponse.json(monthlySummarySchema.parse(summary));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      // Chua thuoc/chua chon duoc doanh nghiep nao -- KHONG the suy ra
      // `month` tu query (chua chac hop le), nen van chan lai o day thanh
      // loi 400 thay vi doan mo mot ban tong hop toan so 0.
      return NextResponse.json(
        { error: "Vui lòng chọn doanh nghiệp bạn muốn truy cập." },
        { status: 400 },
      );
    }
    console.error("Lỗi không xác định ở GET /api/attendance/summary:", cause);
    return NextResponse.json(
      { error: "Không thể tải tổng hợp công tháng." },
      { status: 500 },
    );
  }
}
