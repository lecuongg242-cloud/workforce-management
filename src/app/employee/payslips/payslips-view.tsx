"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { listMyPayslips } from "@/lib/data/payslips";
import { formatDateTime, formatMonthLabel, formatVnd } from "@/lib/format";

/**
 * Danh sach phieu luong cua chinh nguoi dang nhap (PAY-05).
 *
 * KHONG co bo chon thang. Danh sach chi gom nhung ky DA CHOT LUONG, va so ky
 * do it — mot bo chon thang o day se moi nguoi dung di tim mot phieu khong ton
 * tai cho nhung thang chua chot, roi tra ve mot man hinh rong khong giai thich
 * duoc vi sao.
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
          Các kỳ doanh nghiệp đã chốt lương.
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
                    <p className="text-[14px] font-medium text-ink">
                      {formatMonthLabel(payslip.month)}
                    </p>
                    <p className="num mt-0.5 text-[12px] text-ink-muted">
                      Chốt {formatDateTime(payslip.closedAt)}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[15px] font-semibold text-ink">
                    {formatVnd(payslip.netPay)}
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
