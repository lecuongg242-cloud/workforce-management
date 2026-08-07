"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { PAYSLIP_DAILY_LABEL } from "@/lib/constants";
import { listMyPayslips } from "@/lib/data/payslips";
import { formatDateTime, formatMonthLabel, formatVnd } from "@/lib/format";

/**
 * Danh sach phieu luong cua chinh nguoi dang nhap (PAY-05).
 *
 * KHONG co bo chon thang. Danh sach gom cac ky da chot cong them ky DANG MO,
 * va so ky do it — mot bo chon thang o day se moi nguoi dung di tim mot phieu
 * khong ton tai cho nhung thang khac, roi tra ve mot man hinh rong khong giai
 * thich duoc vi sao.
 *
 * Muc DAU tien la ky dang mo, mang nhan "Tam tinh". Nhan do KHONG phai trang
 * tri: no la dieu kien di kem cua viec phat mot con so chua ai chot — xem khoi
 * comment muc (2) o `src/app/api/payslips/route.ts`.
 */
export function PayslipsView(): React.ReactElement {
  const { data, isLoading, error, reload } = useDataQuery(
    () => listMyPayslips(),
    [],
  );

  if (error) {
    return <ErrorState description={error} onRetry={reload} />;
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="display-md text-ink">Phiếu lương</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Tháng này là số tạm tính; các kỳ còn lại đã được chốt lương.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-2.5">
          <Skeleton className="h-[76px] w-full rounded-card" />
          <Skeleton className="h-[76px] w-full rounded-card" />
          <Skeleton className="h-[76px] w-full rounded-card" />
        </div>
      ) : data.length === 0 ? (
        <section className="surface-card">
          <EmptyState
            icon={Receipt}
            title="Chưa có phiếu lương"
            description="Phiếu sẽ xuất hiện sau khi doanh nghiệp chốt lương của kỳ."
          />
        </section>
      ) : (
        <section className="surface-card overflow-hidden">
          <ul className="divide-y divide-hairline">
            {data.map((payslip) => (
              <li key={payslip.month}>
                <Link
                  href={`/employee/payslips/${payslip.month}`}
                  className="flex min-h-[68px] items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas-soft"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-medium text-ink">
                        {payslip.status === "provisional"
                          ? PAYSLIP_DAILY_LABEL.currentPeriodTitle
                          : formatMonthLabel(payslip.month)}
                      </p>
                      {payslip.status === "provisional" ? (
                        <span className="shrink-0 rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-medium text-brand">
                          {PAYSLIP_DAILY_LABEL.provisionalBadge}
                        </span>
                      ) : null}
                    </div>
                    <p className="num mt-0.5 text-[12px] text-ink-muted">
                      {payslip.closedAt === null
                        ? formatMonthLabel(payslip.month)
                        : `Chốt ${formatDateTime(payslip.closedAt)}`}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[15px] font-semibold text-ink">
                    {/* Chua khai muc luong -> khong hien mot so 0 nao. */}
                    {payslip.netPay === null ? "—" : formatVnd(payslip.netPay)}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ink-muted"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
