"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download, Lock, Unlock, Users } from "lucide-react";
import { toast } from "sonner";

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
import { PAYROLL_LABEL } from "@/lib/constants";
import { getPayrollPrep } from "@/lib/data/payroll";
import { formatMonthLabel, formatNumber, shiftMonth } from "@/lib/format";
import { downloadPayrollCsv } from "@/lib/payroll/csv";
import type { PayrollPrep } from "@/lib/types/domain";

/**
 * Bang CHUAN BI luong (`/admin/payroll`).
 *
 * KHONG CO CON SO TIEN NAO tren man hinh nay, va do la co y: V2 chuan bi du
 * lieu cong cho viec tinh luong, khong tinh luong (PROJECT.md §Out of Scope).
 * Chu tro giup noi thang dieu do thay vi de nguoi dung tu suy ra tu mot bang
 * thieu cot.
 *
 * TRANG THAI KY hien ngay canh thang, vi do la dieu ke toan can biet TRUOC KHI
 * dua con so nay di dau: mot ky dang mo van con doi duoc (mot yeu cau duoc
 * duyet, mot lan cham cong bu), con ky da chot thi khoa (PERD-02).
 *
 * Moi con so den tu `GET /api/payroll/summary`, va duong do dung CHUNG
 * `summarizeMonth()` voi `/api/attendance/summary` — man hinh nay va tong hop
 * cua tung nhan vien khong the noi hai con so khac nhau.
 */

/** Phut -> gio thap phan, hai chu so — don vi ma ke toan dung. */
function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

function periodBadge(status: PayrollPrep["periodStatus"]): React.ReactElement {
  if (status === "closed") {
    return (
      <StatusBadge
        kind="custom"
        size="sm"
        label={PAYROLL_LABEL.periodClosed}
        tone="neutral"
        icon={Lock}
      />
    );
  }
  return (
    <StatusBadge
      kind="custom"
      size="sm"
      // Ky chua ton tai va ky dang mo deu co nghia "con doi duoc", nhung noi
      // dung tung truong hop de nguoi doc khong phai doan.
      label={status === "open" ? PAYROLL_LABEL.periodOpen : PAYROLL_LABEL.periodMissing}
      tone="warning"
      icon={Unlock}
    />
  );
}

export function PayrollView({ today }: { today: string }): React.ReactElement {
  const session = useAuthenticatedSession();

  // Mac dinh la THANG TRUOC: bang luong duoc lam sau khi thang da qua, va
  // thang hien tai thi chua co gi de ban giao.
  const [month, setMonth] = React.useState(() => shiftMonth(today.slice(0, 7), -1));

  const { data, isLoading, error, reload } = useDataQuery(
    () => getPayrollPrep(month),
    [session.companyId, month],
  );

  const totals = React.useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      employees: rows.length,
      workedDays: rows.reduce((sum, row) => sum + row.workedDays, 0),
      minutes: rows.reduce((sum, row) => sum + row.totalMinutes, 0),
      overtimeMinutes: rows.reduce((sum, row) => sum + row.overtimeMinutes, 0),
    };
  }, [data]);

  const handleExport = (): void => {
    if (!data) return;
    downloadPayrollCsv(data);
    toast.success(PAYROLL_LABEL.exportedToast);
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title={PAYROLL_LABEL.pageTitle}
        description={PAYROLL_LABEL.pageDescription}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              aria-label="Tháng trước"
              onClick={() => setMonth((current) => shiftMonth(current, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span className="num min-w-[8.5rem] text-center text-sm font-medium text-ink">
              {formatMonthLabel(month)}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Tháng sau"
              onClick={() => setMonth((current) => shiftMonth(current, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button
              className="ml-1"
              onClick={handleExport}
              disabled={!data || data.rows.length === 0}
            >
              <Download aria-hidden="true" />
              {PAYROLL_LABEL.exportAction}
            </Button>
          </div>
        }
      />

      {data ? (
        <div className="flex flex-wrap items-center gap-3">
          {periodBadge(data.periodStatus)}
          <span className="text-[13px] text-ink-muted">
            <span className="num font-medium text-ink">
              {formatNumber(totals.employees)}
            </span>{" "}
            nhân viên ·{" "}
            <span className="num font-medium text-ink">
              {formatNumber(totals.workedDays)}
            </span>{" "}
            ngày công ·{" "}
            <span className="num font-medium text-ink">
              {formatNumber(toHours(totals.minutes))}
            </span>{" "}
            giờ làm ·{" "}
            <span className="num font-medium text-ink">
              {formatNumber(toHours(totals.overtimeMinutes))}
            </span>{" "}
            giờ tăng ca
          </span>
        </div>
      ) : null}

      <div className="surface-card overflow-hidden">
        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading || !data ? (
          <DataTableSkeleton rows={6} columns={8} />
        ) : data.rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={PAYROLL_LABEL.emptyTitle}
            description={PAYROLL_LABEL.emptyBody}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{PAYROLL_LABEL.employeeColumn}</TableHead>
                  <TableHead>{PAYROLL_LABEL.departmentColumn}</TableHead>
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.workedDaysColumn}
                  </TableHead>
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.totalHoursColumn}
                  </TableHead>
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.overtimeColumn}
                  </TableHead>
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.convertedColumn}
                  </TableHead>
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.leaveColumn}
                  </TableHead>
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.lateColumn}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell>
                      <div className="font-medium text-ink">{row.employeeName}</div>
                      <div className="num text-xs text-ink-muted">
                        {row.employeeCode}
                      </div>
                    </TableCell>
                    <TableCell className="text-ink-secondary">
                      {row.departmentName ?? "—"}
                    </TableCell>
                    <TableCell className="num text-right text-ink-secondary">
                      {formatNumber(row.workedDays)}
                    </TableCell>
                    <TableCell className="num text-right text-ink-secondary">
                      {formatNumber(toHours(row.totalMinutes))}
                    </TableCell>
                    <TableCell className="num text-right text-ink-secondary">
                      {formatNumber(toHours(row.overtimeMinutes))}
                    </TableCell>
                    <TableCell className="num text-right">
                      {row.convertedOvertimeHours === null ? (
                        // D-26: thieu he so tra `null`, KHONG BAO GIO ngam lay
                        // 1.0 — mot con so bia ra o day se di thang vao bang
                        // luong that.
                        <span
                          className="text-xs font-normal text-warning"
                          title={PAYROLL_LABEL.missingMultiplierHint}
                        >
                          {PAYROLL_LABEL.missingMultiplier}
                        </span>
                      ) : (
                        <span className="font-medium text-ink">
                          {formatNumber(row.convertedOvertimeHours)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="num text-right text-ink-secondary">
                      {formatNumber(row.leaveDays)}
                    </TableCell>
                    <TableCell className="num text-right text-ink-secondary">
                      {formatNumber(row.lateCount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
