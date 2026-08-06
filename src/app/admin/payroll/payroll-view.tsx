"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Lock,
  LockKeyhole,
  Unlock,
  Users,
} from "lucide-react";
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
import {
  PAYROLL_LABEL,
  WORK_MODE_LABEL,
  describeMissingReason,
} from "@/lib/constants";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { closePayroll, getPayrollPrep, reopenPayroll } from "@/lib/data/payroll";
import { useDataStore } from "@/lib/data/store";
import {
  formatDateTime,
  formatMonthLabel,
  formatNumber,
  formatVnd,
  shiftMonth,
} from "@/lib/format";
import { downloadPayrollCsv } from "@/lib/payroll/csv";
import type { PayrollPrep, PayrollPrepRow } from "@/lib/types/domain";

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

/**
 * Mot o SO TIEN.
 *
 * `null` KHONG BAO GIO duoc hien thanh 0: mot o `0` trong bang luong doc nhu
 * MOT SU THAT ("nguoi nay khong duoc tra gi") va nguoi ky duyet se ky. O do
 * mang chu noi THIEU GI, va chu do la mot cau nguoi dung lam duoc gi voi no.
 */
function MoneyCell({
  value,
  missing,
  emphasis = false,
}: {
  value: number | null;
  missing: readonly string[];
  emphasis?: boolean;
}): React.ReactElement {
  if (value === null) {
    const reason =
      missing.length > 0
        ? describeMissingReason(missing[0])
        : PAYROLL_LABEL.missingReasonFallback;
    return (
      <TableCell className="text-right">
        <span className="text-xs font-normal text-warning">{reason}</span>
      </TableCell>
    );
  }

  return (
    <TableCell
      className={
        emphasis
          ? "num text-right font-semibold text-ink"
          : "num text-right text-ink-secondary"
      }
    >
      {formatVnd(value)}
    </TableCell>
  );
}

/**
 * Khoi chi tiet cua mot dong luong: tung khoan phu cap va khau tru kem ten va
 * so tien.
 *
 * Day la cho nguoi xem tra loi duoc "vi sao ra con so nay" ma khong phai hoi
 * ai — va la cho phep cong duoc bay ra tuong minh de doi chieu.
 */
function PayrollRowDetail({ row }: { row: PayrollPrepRow }): React.ReactElement {
  return (
    <div className="grid gap-4 border-t border-hairline px-4 py-4 md:grid-cols-3">
      <section>
        <h3 className="text-[13px] font-medium text-ink">
          {PAYROLL_LABEL.detailTitle}
        </h3>
        <dl className="mt-2 grid gap-1.5 text-[13px]">
          <DetailRow label={PAYROLL_LABEL.detailBaseLabel} value={row.basePay} />
          <DetailRow
            label={PAYROLL_LABEL.detailOvertimeLabel}
            value={row.overtimePay}
          />
          {row.hourAdjustment !== null && row.hourAdjustment !== 0 ? (
            <DetailRow
              label={PAYROLL_LABEL.detailHourAdjustmentLabel}
              value={row.hourAdjustment}
            />
          ) : null}
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-hairline pt-1.5">
            <dt className="font-medium text-ink">
              {PAYROLL_LABEL.detailNetLabel}
            </dt>
            <dd className="num font-semibold text-ink">
              {row.netPay === null ? "—" : formatVnd(row.netPay)}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="text-[13px] font-medium text-ink">
          {PAYROLL_LABEL.detailAllowanceTitle}
        </h3>
        {row.allowanceItems.length === 0 ? (
          <p className="mt-2 text-xs text-ink-muted">
            {PAYROLL_LABEL.detailEmptyAdjustments}
          </p>
        ) : (
          <dl className="mt-2 grid gap-1.5 text-[13px]">
            {row.allowanceItems.map((item) => (
              <div
                key={item.adjustmentId}
                className="flex items-baseline justify-between gap-3"
              >
                <dt className="text-ink-secondary">
                  {item.name}
                  {item.multiplier !== 1 ? (
                    <span className="num text-xs text-ink-muted">
                      {" "}
                      × {item.multiplier} {PAYROLL_LABEL.detailPerLateSuffix}
                    </span>
                  ) : null}
                </dt>
                <dd className="num text-ink">{formatVnd(item.amount)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section>
        <h3 className="text-[13px] font-medium text-ink">
          {PAYROLL_LABEL.detailDeductionTitle}
        </h3>
        {row.deductionItems.length === 0 ? (
          <p className="mt-2 text-xs text-ink-muted">
            {PAYROLL_LABEL.detailEmptyAdjustments}
          </p>
        ) : (
          <dl className="mt-2 grid gap-1.5 text-[13px]">
            {row.deductionItems.map((item) => (
              <div
                key={item.adjustmentId}
                className="flex items-baseline justify-between gap-3"
              >
                <dt className="text-ink-secondary">
                  {item.name}
                  {item.multiplier !== 1 ? (
                    <span className="num text-xs text-ink-muted">
                      {" "}
                      × {item.multiplier} {PAYROLL_LABEL.detailPerLateSuffix}
                    </span>
                  ) : null}
                </dt>
                <dd className="num text-ink">−{formatVnd(item.amount)}</dd>
              </div>
            ))}
          </dl>
        )}

        {row.missing.length > 0 ? (
          <div className="mt-3 border-t border-hairline pt-2">
            <p className="text-xs font-medium text-warning">
              {PAYROLL_LABEL.detailMissingTitle}
            </p>
            <ul className="mt-1 grid gap-0.5">
              {row.missing.map((key) => (
                <li key={key} className="text-xs text-ink-secondary">
                  · {describeMissingReason(key)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: number | null;
}): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="num text-ink">{value === null ? "—" : formatVnd(value)}</dd>
    </div>
  );
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

/**
 * Huy hieu trang thai CHOT LUONG (D-42) — khac huy hieu chot KY CONG o tren.
 * Hai thu tra loi hai cau hoi khac nhau va deu can hien: mot ky co the da chot
 * cong ma chua chot luong.
 */
function payrollBadge(
  status: PayrollPrep["payrollStatus"],
  closedAt: string | null,
): React.ReactElement {
  if (status === "closed") {
    return (
      <StatusBadge
        kind="custom"
        size="sm"
        label={
          closedAt
            ? `${PAYROLL_LABEL.payrollClosed} · ${PAYROLL_LABEL.payrollClosedBySuffix} ${formatDateTime(closedAt)}`
            : PAYROLL_LABEL.payrollClosed
        }
        tone="success"
        icon={LockKeyhole}
      />
    );
  }
  return (
    <StatusBadge
      kind="custom"
      size="sm"
      label={PAYROLL_LABEL.payrollOpen}
      tone="neutral"
      icon={Unlock}
    />
  );
}

export function PayrollView({ today }: { today: string }): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

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
      // Tong THUC NHAN cong tu chinh cac o hien ra o cot do — nen tong bang
      // dung tong cac dong. Dong nao chua tinh duoc thi KHONG duoc coi la 0:
      // no bi dem rieng va noi ra thanh mot con so nguoi, khong lang le tut
      // khoi tong.
      netPay: rows.reduce((sum, row) => sum + (row.netPay ?? 0), 0),
      incompleteCount: rows.filter((row) => row.netPay === null).length,
    };
  }, [data]);

  // Dong dang mo khoi chi tiet — `null` khi khong dong nao mo.
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const hasMissingWorkModeInput = (data?.rows ?? []).some(
    (row) => row.missingWorkModeInputs.length > 0,
  );
  // Cot "Lech gio so voi ca" chi co nghia o `shift_hourly`; o hai che do con
  // lai no luon bang 0, va mot cot toan so 0 lam bang dai ra ma khong noi gi.
  const showHourDelta = data?.workMode === "shift_hourly";

  const handleExport = (): void => {
    if (!data) return;
    downloadPayrollCsv(data);
    toast.success(PAYROLL_LABEL.exportedToast);
  };

  /* ------------------------------------------------------------------ */
  /* Chot luong / huy chot luong (D-42/D-45)                             */
  /* ------------------------------------------------------------------ */
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [confirmReopen, setConfirmReopen] = React.useState(false);
  const [reopenReason, setReopenReason] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);

  const isPayrollClosed = data?.payrollStatus === "closed";
  const incompleteCount = totals.incompleteCount;
  // Hai ly do khien nut bi vo hieu, moi ly do co MOT CAU noi ro phai lam gi —
  // mot nut xam im lang chi lam nguoi dung doan.
  const closeBlockedReason: string | null = !data
    ? null
    : data.periodStatus !== "closed"
      ? PAYROLL_LABEL.closeBlockedPeriodOpen
      : incompleteCount > 0
        ? PAYROLL_LABEL.closeBlockedIncomplete.replace(
            "{n}",
            String(incompleteCount),
          )
        : data.rows.length === 0
          ? PAYROLL_LABEL.emptyBody
          : null;

  const handleClose = async (): Promise<void> => {
    setIsPending(true);
    try {
      await closePayroll(month);
      toast.success(PAYROLL_LABEL.closeSuccess);
      invalidate();
      reload();
      setConfirmClose(false);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : PAYROLL_LABEL.closeError,
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleReopen = async (): Promise<void> => {
    setIsPending(true);
    try {
      await reopenPayroll(month, reopenReason);
      toast.success(PAYROLL_LABEL.reopenSuccess);
      invalidate();
      reload();
      setConfirmReopen(false);
      setReopenReason("");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : PAYROLL_LABEL.reopenError,
      );
    } finally {
      setIsPending(false);
    }
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
              variant="outline"
              className="ml-1"
              onClick={handleExport}
              disabled={!data || data.rows.length === 0}
            >
              <Download aria-hidden="true" />
              {PAYROLL_LABEL.exportAction}
            </Button>

            {/* MOT nut filled indigo cua khu vuc nay (quy uoc globals.css) la
                "Chot luong ky" — do la thao tac chinh cua man hinh. Ky da chot
                thi cho nut phu tong canh bao. */}
            {isPayrollClosed ? (
              <Button
                variant="outline"
                className="text-danger"
                onClick={() => setConfirmReopen(true)}
              >
                <Unlock aria-hidden="true" />
                {PAYROLL_LABEL.reopenAction}
              </Button>
            ) : (
              <Button
                onClick={() => setConfirmClose(true)}
                disabled={!data || closeBlockedReason !== null}
              >
                <LockKeyhole aria-hidden="true" />
                {PAYROLL_LABEL.closeAction}
              </Button>
            )}
          </div>
        }
      />

      {/* Nut bi vo hieu KHONG duoc im lang: cau duoi day noi ro can lam gi. */}
      {data && !isPayrollClosed && closeBlockedReason ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5 text-[13px] text-ink-secondary"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {closeBlockedReason}{" "}
            {data.periodStatus !== "closed" ? (
              <Link href="/admin/periods" className="font-medium underline">
                Mở trang Kỳ công
              </Link>
            ) : null}
          </span>
        </p>
      ) : null}

      {data ? (
        <div className="flex flex-wrap items-center gap-3">
          {periodBadge(data.periodStatus)}
          {payrollBadge(data.payrollStatus, data.payrollClosedAt)}
          {/* D-36: che do dang ap noi ngay canh trang thai ky. Cung mot bang
              doc ra hai con so khac nhau o hai che do khac nhau, nen nguoi
              doc phai biet minh dang nhin bang nao. */}
          <span className="text-[13px] text-ink-muted">
            {PAYROLL_LABEL.workModePrefix}{" "}
            <span className="font-medium text-ink">
              {WORK_MODE_LABEL[data.workMode]}
            </span>
          </span>
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
            giờ tăng ca ·{" "}
            <span className="num font-semibold text-ink">
              {formatVnd(totals.netPay)}
            </span>{" "}
            thực nhận
            {/* Dong chua tinh duoc KHONG bi coi la 0 va lang le tut khoi tong —
                no duoc dem rieng va noi ra. */}
            {totals.incompleteCount > 0 ? (
              <span className="text-warning">
                {" "}
                (chưa gồm{" "}
                <span className="num font-medium">{totals.incompleteCount}</span>{" "}
                người chưa đủ dữ kiện)
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      {/* (c) Chu thich CO DINH, khong phai mot dong nho o goc: hieu nham rang
          con so nay da tru thue va bao hiem la dieu de xay ra nhat cua ca man
          hinh, va hau qua la doanh nghiep tra thieu cho nguoi lao dong. */}
      <p className="flex items-start gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5 text-[13px] text-ink-secondary">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          {PAYROLL_LABEL.taxDisclaimer}{" "}
          <span className="text-ink-muted">{PAYROLL_LABEL.expandHint}</span>
        </span>
      </p>

      {/* D-38: thieu mau so quy doi thi noi THANG va chi duong sang cho khai,
          thay vi de mot cot "—" ma khong ai biet vi sao no trong. */}
      {hasMissingWorkModeInput ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-control border border-warning-border bg-warning-soft px-3 py-2.5 text-[13px] text-ink"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {PAYROLL_LABEL.missingWorkModeBanner}{" "}
            <Link href="/admin/settings" className="font-medium underline">
              Mở trang Cài đặt
            </Link>
          </span>
        </p>
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
                  {/* Cot RIENG, khong thay the "Ngay cong": o che do
                      `daily_hours` hai con so nay khac nhau, va gop chung lai
                      se lam ke toan cong nham. */}
                  <TableHead
                    className="text-right"
                    title={PAYROLL_LABEL.creditedDaysHint}
                  >
                    {PAYROLL_LABEL.creditedDaysColumn}
                  </TableHead>
                  {showHourDelta ? (
                    <TableHead
                      className="text-right"
                      title={PAYROLL_LABEL.hourDeltaHint}
                    >
                      {PAYROLL_LABEL.hourDeltaColumn}
                    </TableHead>
                  ) : null}
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
                  {/* Cac cot TIEN, ben phai cac cot cong. */}
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.basePayColumn}
                  </TableHead>
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.overtimePayColumn}
                  </TableHead>
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.allowanceColumn}
                  </TableHead>
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.deductionColumn}
                  </TableHead>
                  <TableHead className="text-right">
                    {PAYROLL_LABEL.netPayColumn}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <React.Fragment key={row.employeeId}>
                  <TableRow
                    // (b) Bam mot dong de thay VI SAO ra con so do. Khoi chi
                    // tiet la thu duy nhat tra loi duoc cau hoi ay ma khong
                    // phai di hoi ai.
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(
                        expandedId === row.employeeId ? null : row.employeeId,
                      )
                    }
                  >
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
                    <TableCell className="num text-right">
                      {row.creditedDays === null ? (
                        // Thieu mau so quy doi (D-38) — noi thang la chua
                        // khai, KHONG hien 0. Mot o `0` o day doc ra thanh
                        // "nguoi nay khong lam ngay nao".
                        <span
                          className="text-xs font-normal text-warning"
                          title={PAYROLL_LABEL.missingWorkModeInputHint}
                        >
                          {PAYROLL_LABEL.missingWorkModeInput}
                        </span>
                      ) : (
                        <span className="font-medium text-ink">
                          {formatNumber(row.creditedDays)}
                        </span>
                      )}
                    </TableCell>
                    {showHourDelta ? (
                      <TableCell className="num text-right text-ink-secondary">
                        {formatNumber(toHours(row.hourDeltaMinutes))}
                      </TableCell>
                    ) : null}
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

                    {/* Nam o TIEN. Dong thieu du kien hien CHU noi thieu gi,
                        khong hien mot con so — mot o `0` doc nhu mot su that
                        va nguoi ky duyet se ky. */}
                    <MoneyCell value={row.basePay} missing={row.missing} />
                    <MoneyCell value={row.overtimePay} missing={row.missing} />
                    <MoneyCell value={row.allowanceTotal} missing={row.missing} />
                    <MoneyCell value={row.deductionTotal} missing={row.missing} />
                    <MoneyCell value={row.netPay} missing={row.missing} emphasis />
                  </TableRow>

                  {expandedId === row.employeeId ? (
                    <TableRow className="bg-canvas-soft hover:bg-canvas-soft">
                      <TableCell colSpan={showHourDelta ? 16 : 15} className="p-0">
                        <PayrollRowDetail row={row} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Hop thoai CHOT — noi du ba dieu: cai gi duoc dong khung, he qua cua
          viec dong khung, va duong lui. Thieu dieu thu ba thi nguoi dung se
          khong dam bam. */}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={PAYROLL_LABEL.closeDialogTitle}
        description={PAYROLL_LABEL.closeDialogBody}
        confirmLabel={PAYROLL_LABEL.closeConfirm}
        isPending={isPending}
        onConfirm={handleClose}
      />

      {/* Hop thoai HUY — LY DO BAT BUOC (D-45): huy mot ban tuyen bo tai chinh
          ma khong noi vi sao la xoa mot su kien trong im lang. */}
      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={(open) => {
          setConfirmReopen(open);
          if (!open) setReopenReason("");
        }}
        title={PAYROLL_LABEL.reopenDialogTitle}
        description={
          <div className="grid gap-3">
            <p>{PAYROLL_LABEL.reopenDialogBody}</p>
            <div className="grid gap-1.5">
              <label
                htmlFor="payroll-reopen-reason"
                className="text-[13px] font-medium text-ink-secondary"
              >
                {PAYROLL_LABEL.reopenReasonLabel}
                <span className="text-danger" aria-hidden="true">
                  *
                </span>
              </label>
              <Textarea
                id="payroll-reopen-reason"
                rows={3}
                value={reopenReason}
                placeholder={PAYROLL_LABEL.reopenReasonPlaceholder}
                onChange={(event) => setReopenReason(event.target.value)}
              />
              <p className="text-xs text-ink-muted">
                {PAYROLL_LABEL.reopenReasonRequired}
              </p>
            </div>
          </div>
        }
        confirmLabel={PAYROLL_LABEL.reopenConfirm}
        tone="destructive"
        // Chan ngay tai nut: khong de nguoi dung bam roi moi nhan mot loi.
        isPending={isPending || reopenReason.trim().length === 0}
        onConfirm={handleReopen}
      />
    </div>
  );
}
