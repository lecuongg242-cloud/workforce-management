"use client";

import * as React from "react";
import { CalendarCheck, CircleDot, Lock } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { PERIOD_LABEL } from "@/lib/constants";
import { closePeriod, listPeriods } from "@/lib/data/periods";
import { useDataStore } from "@/lib/data/store";
import { formatDateTime, formatMonthLabel, formatNumber } from "@/lib/format";
import type { PeriodSummary } from "@/lib/types/domain";

/**
 * Man hinh ky cong cua quan tri (PERD-01, plan 05-05).
 *
 * CHOT KY LA MOT CUA MOT CHIEU (D-32b): phien ban nay khong co duong mo lai,
 * va man hinh noi ro dieu do trong hop xac nhan thay vi de nguoi dung di tim
 * mot nut khong ton tai.
 *
 * Trang thai phan biet bang BIEU TUONG + NHAN CHU (`StatusBadge` custom),
 * khong bang mau don thuan.
 */
export function PeriodsView(): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const [closeTarget, setCloseTarget] = React.useState<PeriodSummary | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const { data: periods, isLoading, error, reload } = useDataQuery(
    () => listPeriods(),
    [session.companyId],
  );

  const handleClose = async (): Promise<void> => {
    if (!closeTarget) return;
    setIsPending(true);
    try {
      await closePeriod(closeTarget.month);
      invalidate();
      reload();
      toast.success(PERIOD_LABEL.closeSuccess, {
        description: `Kỳ ${formatMonthLabel(closeTarget.month)} đã khoá.`,
      });
      setCloseTarget(null);
    } catch (cause) {
      // Thong diep tu ham SQL da noi ro ly do (chua ket thuc / da chot) —
      // hien nguyen van.
      toast.error(
        cause instanceof Error ? cause.message : PERIOD_LABEL.closeError,
      );
    } finally {
      setIsPending(false);
    }
  };

  const items = periods ?? [];
  const closedCount = items.filter((item) => item.status === "closed").length;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={PERIOD_LABEL.pageTitle}
        description={
          periods ? (
            <>
              <span className="num font-medium text-ink">
                {formatNumber(closedCount)}
              </span>{" "}
              trong số{" "}
              <span className="num font-medium text-ink">
                {formatNumber(items.length)}
              </span>{" "}
              kỳ gần đây đã chốt. {PERIOD_LABEL.pageDescription}
            </>
          ) : (
            "Đang tải danh sách kỳ công…"
          )
        }
      />

      <div className="surface-card overflow-hidden">
        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading ? (
          <DataTableSkeleton rows={6} columns={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={PERIOD_LABEL.emptyTitle}
            description={PERIOD_LABEL.emptyBody}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kỳ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Dữ liệu</TableHead>
                  <TableHead>Chốt bởi</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((period) => {
                  const closed = period.status === "closed";
                  return (
                    <TableRow key={period.month}>
                      <TableCell className="num font-medium whitespace-nowrap text-ink">
                        {formatMonthLabel(period.month)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          kind="custom"
                          size="sm"
                          label={
                            closed
                              ? PERIOD_LABEL.statusClosed
                              : PERIOD_LABEL.statusOpen
                          }
                          tone={closed ? "neutral" : "success"}
                          icon={closed ? Lock : CircleDot}
                        />
                      </TableCell>
                      <TableCell className="text-right text-[13px] text-ink-secondary">
                        <div className="num">
                          {formatNumber(period.employeeCount)}{" "}
                          {PERIOD_LABEL.employeeCountLabel}
                        </div>
                        <div className="num text-xs text-ink-muted">
                          {formatNumber(period.recordCount)}{" "}
                          {PERIOD_LABEL.recordCountLabel}
                          {period.pendingRequestCount > 0
                            ? ` · ${formatNumber(period.pendingRequestCount)} ${
                                PERIOD_LABEL.pendingCountLabel
                              }`
                            : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] text-ink-secondary">
                        {period.closedAt ? (
                          <span className="num">
                            {formatDateTime(period.closedAt)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Nut chi hien voi ky DA KET THUC va DANG MO. Ky chua
                            ket thuc noi ro vi sao khong bam duoc, thay vi mot
                            nut xam khong giai thich gi. */}
                        {closed ? (
                          <span className="text-xs text-ink-muted">—</span>
                        ) : period.hasEnded ? (
                          <Button size="sm" onClick={() => setCloseTarget(period)}>
                            {PERIOD_LABEL.closeAction}
                          </Button>
                        ) : (
                          <span className="text-xs text-ink-muted">
                            {PERIOD_LABEL.notEndedHint}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={closeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCloseTarget(null);
        }}
        title={`${PERIOD_LABEL.closeConfirmTitle} ${
          closeTarget ? formatMonthLabel(closeTarget.month) : ""
        }?`}
        description={
          closeTarget && closeTarget.pendingRequestCount > 0
            ? `${PERIOD_LABEL.closeConfirmBody} Hiện còn ${formatNumber(
                closeTarget.pendingRequestCount,
              )} ${PERIOD_LABEL.pendingWarning}`
            : PERIOD_LABEL.closeConfirmBody
        }
        confirmLabel={PERIOD_LABEL.closeConfirmLabel}
        tone="destructive"
        isPending={isPending}
        onConfirm={handleClose}
      />
    </div>
  );
}
