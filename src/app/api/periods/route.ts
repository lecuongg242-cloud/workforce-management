import { NextResponse } from "next/server";

import {
  ForbiddenError,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  getSessionContext,
  canReadCompanyData,
} from "@/lib/auth/session-context";
import { getServerToday } from "@/lib/today";
import { shiftMonth } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  periodRowSchema,
  periodSummaryListResponseSchema,
} from "@/lib/validation/api/periods";

/**
 * Ky cong cua doanh nghiep trong phien (PERD-01, plan 05-05). Khuon 02-04
 * (D-12c): chi xuat `dynamic` va `GET`.
 *
 * Chi `owner`/`admin` doc: day la man hinh dieu khien mot thao tac MOT CHIEU.
 *
 * DANH SACH KHONG CHI GOM CAC KY DA CO DONG TRONG BANG. Mot doanh nghiep chua
 * chot ky nao thi bang `periods` rong, va mot man hinh rong se khong co gi de
 * bam — nen cac thang GAN DAY duoc dung ra tu lich (12 thang tro lai) va ghep
 * voi dong that neu co. Dong ky chi duoc TAO khi that su chot (trong
 * `tf_close_period`), khong phai moi lan ai do mo man hinh nay.
 *
 * Ba con so tom tat duoc DEM TAI THOI DIEM TRUY VAN — khong cot nao luu san,
 * cung khuon voi moi so lieu cua Phase 4.
 */
export const dynamic = "force-dynamic";

const PERIOD_COLUMNS =
  "id, company_id, start_date, end_date, status, closed_at, closed_by";

/** So thang gan day dung ra tren man hinh khi chua co dong ky nao. */
const RECENT_MONTHS = 12;

/** "YYYY-MM" -> ngay dau va ngay cuoi thang, khong dung `new Date()` (D-19a). */
function monthBounds(month: string): { start: string; end: string; nextStart: string } {
  const nextStart = `${shiftMonth(month, 1)}-01`;
  return { start: `${month}-01`, end: nextStart, nextStart };
}

export async function GET(): Promise<NextResponse> {
  try {
    const { companyId, role } = await getSessionContext();
    if (!canReadCompanyData(role)) throw new ForbiddenError();

    const today = await getServerToday();
    const currentMonth = today.slice(0, 7);

    const supabase = await createServerSupabase();

    // Doc TOAN BO ky cua doanh nghiep truoc, KHONG gioi han theo ngay: mot ky
    // DA CHOT phai luon nhin thay duoc, ke ca khi no cu hon cua so 12 thang.
    // Gioi han cua so o day tung lam mot ky da chot bien mat khoi man hinh —
    // kich ban e2e cua 05-06 la thu bat duoc.
    const { data: periodRows, error: periodError } = await supabase
      .from("periods")
      .select(PERIOD_COLUMNS)
      .eq("company_id", companyId);

    if (periodError) {
      return NextResponse.json(
        { error: "Không thể tải danh sách kỳ công." },
        { status: 500 },
      );
    }

    const existingPeriods = ((periodRows ?? []) as unknown[]).map((row) =>
      periodRowSchema.parse(row),
    );

    // Thang hien ra = 12 thang gan day HOP voi moi thang da co dong ky.
    const recent = Array.from({ length: RECENT_MONTHS }, (_, index) =>
      shiftMonth(currentMonth, -index),
    );
    const months = Array.from(
      new Set([...recent, ...existingPeriods.map((p) => p.startDate.slice(0, 7))]),
    ).sort((a, b) => b.localeCompare(a));

    const oldest = `${months[months.length - 1]}-01`;

    const [recordResult, requestResult] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("employee_id, work_date")
        .eq("company_id", companyId)
        .gte("work_date", oldest),
      supabase
        .from("work_requests")
        .select("from_date")
        .eq("company_id", companyId)
        .eq("status", "pending")
        .gte("from_date", oldest),
    ]);

    if (recordResult.error || requestResult.error) {
      return NextResponse.json(
        { error: "Không thể tải danh sách kỳ công." },
        { status: 500 },
      );
    }

    const periodByMonth = new Map(
      existingPeriods.map((period) => [period.startDate.slice(0, 7), period]),
    );

    const employeesByMonth = new Map<string, Set<string>>();
    const recordsByMonth = new Map<string, number>();
    for (const row of (recordResult.data ?? []) as Array<{
      employee_id: string;
      work_date: string;
    }>) {
      const month = row.work_date.slice(0, 7);
      const set = employeesByMonth.get(month) ?? new Set<string>();
      set.add(row.employee_id);
      employeesByMonth.set(month, set);
      recordsByMonth.set(month, (recordsByMonth.get(month) ?? 0) + 1);
    }

    const pendingByMonth = new Map<string, number>();
    for (const row of (requestResult.data ?? []) as Array<{ from_date: string }>) {
      const month = row.from_date.slice(0, 7);
      pendingByMonth.set(month, (pendingByMonth.get(month) ?? 0) + 1);
    }

    const items = months.map((month) => {
      const bounds = monthBounds(month);
      const existing = periodByMonth.get(month);
      return {
        id: existing?.id ?? `period-${companyId}-${month}`,
        companyId,
        startDate: bounds.start,
        // Ngay cuoi thang = ngay truoc ngay dau thang ke tiep, tinh bang chuoi
        // lich cua chinh database khi co dong that; khi chua co dong nao thi
        // moc nay chi de hien thi.
        endDate: existing?.endDate ?? bounds.nextStart,
        status: existing?.status ?? ("open" as const),
        closedAt: existing?.closedAt ?? null,
        closedBy: existing?.closedBy ?? null,
        month,
        employeeCount: employeesByMonth.get(month)?.size ?? 0,
        recordCount: recordsByMonth.get(month) ?? 0,
        pendingRequestCount: pendingByMonth.get(month) ?? 0,
        // Ky da ket thuc khi ngay dau thang KE TIEP khong con o tuong lai —
        // so voi NGAY CUA SERVER, khong voi dong ho trinh duyet (D-19).
        hasEnded: bounds.nextStart <= today,
      };
    });

    return NextResponse.json(periodSummaryListResponseSchema.parse(items));
  } catch (cause) {
    if (cause instanceof UnauthenticatedError) {
      return NextResponse.json({ error: cause.message }, { status: 401 });
    }
    if (cause instanceof ForbiddenError) {
      return NextResponse.json({ error: cause.message }, { status: 403 });
    }
    if (cause instanceof NoMembershipError || cause instanceof NoActiveCompanyError) {
      return NextResponse.json(periodSummaryListResponseSchema.parse([]));
    }
    console.error("Lỗi không xác định ở GET /api/periods:", cause);
    return NextResponse.json(
      { error: "Không thể tải danh sách kỳ công." },
      { status: 500 },
    );
  }
}
