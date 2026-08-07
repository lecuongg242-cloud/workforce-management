"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { DailyPayList } from "@/components/payroll/daily-pay-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import {
  PAYSLIP_DAILY_LABEL,
  PAY_RATE_UNIT_SUFFIX,
  describeMissingReason,
} from "@/lib/constants";
import { getMyPayslip } from "@/lib/data/payslips";
import {
  formatDateTime,
  formatDurationShort,
  formatMonthLabel,
  formatNumber,
  formatVnd,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Chi tiet mot phieu luong (PAY-05).
 *
 * ======================================================================
 * THU TU CAC KHOI TRA LOI MOT CAU HOI, KHONG PHAI HAI
 * ======================================================================
 *
 * "Thang roi toi duoc tra bao nhieu, VA VI SAO." Vi vay:
 *   1. Thuc nhan — cau tra loi, dat trước tien
 *   2. Cac khoan cong/tru — phan "vi sao ra con so do"
 *   3. So lieu cong — phan "vi sao cac khoan lai la nhung con so do"
 *
 * Nguoc lai (cong truoc, tien sau) se bat nguoi doc di qua bon bang truoc khi
 * thay dieu ho mo man hinh nay de xem.
 *
 * MOI CON SO DEU DEN TU SERVER. Man hinh nay khong cong lai, khong suy ra,
 * khong lam tron gi ngoai viec dinh dang — ke ca `netPay`, von co the tinh lai
 * tu cac thanh phan. Tinh lai o day la mo duong cho mot phieu tu mau thuan voi
 * chinh no khi mot thanh phan nao do doi cach luu.
 *
 * ======================================================================
 * HAI HINH DANG, VA MAN HINH PHAI NOI RO DANG XEM CAI NAO
 * ======================================================================
 *
 * Ky DA CHOT (`status: "closed"`) mang con so bat bien, moi truong tien deu co.
 * Ky DANG MO (`status: "provisional"`) mang con so TAM TINH, va tien co the
 * `null` khi chua khai muc luong.
 *
 * Dai canh bao o dau trang la BAT BUOC voi ky dang mo — khong phai trang tri.
 * Do la dieu kien di kem cua viec phat mot con so chua ai duyet cho nguoi lam
 * cong (xem khoi comment muc (2) o `src/app/api/payslips/route.ts`).
 */
export function PayslipDetailView({
  month,
}: {
  month: string;
}): React.ReactElement {
  const { data, isLoading, error, reload } = useDataQuery(
    () => getMyPayslip(month),
    [month],
  );

  if (error) {
    return <ErrorState description={error} onRetry={reload} />;
  }

  return (
    <div className="grid gap-4">
      <Link
        href="/employee/payslips"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Tất cả phiếu lương
      </Link>

      {isLoading ? (
        <>
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-48 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </>
      ) : !data ? (
        <section className="surface-card">
          <EmptyState
            icon={Receipt}
            title={`Chưa có phiếu lương ${formatMonthLabel(month).toLowerCase()}`}
            description="Kỳ này chưa được chốt lương, hoặc bạn chưa làm việc trong kỳ."
          />
        </section>
      ) : (
        <>
          {/* Ky DANG MO — noi ro truoc moi con so. */}
          {data.status === "provisional" ? (
            <p
              role="status"
              className="rounded-card border border-warning-border bg-warning-soft px-4 py-3 text-[13px] text-ink-secondary"
            >
              {PAYSLIP_DAILY_LABEL.provisionalBanner}
            </p>
          ) : null}

          {/* 1. THUC NHAN */}
          <section className="surface-card p-5 text-center">
            <p className="text-[13px] text-ink-muted">
              {formatMonthLabel(data.month)}
            </p>
            <p className="num mt-1.5 display-md text-ink">
              {data.netPay === null ? "—" : formatVnd(data.netPay)}
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">Thực nhận</p>
            {/* Mot dong duy nhat noi ve trang thai chot — dai canh bao o tren
                da noi "tam tinh" roi, lap lai o day chi lam loang. */}
            <p className="num mt-3 text-[12px] text-ink-muted">
              {data.closedAt === null
                ? PAYSLIP_DAILY_LABEL.notClosedYet
                : `Chốt ${formatDateTime(data.closedAt)}`}
            </p>
          </section>

          {/* Thieu du kien -> noi RO thieu gi, khong de mot dau gach ngang
              khong giai thich duoc. Chi ky dang mo moi co the roi vao day. */}
          {data.status === "provisional" && data.missing.length > 0 ? (
            <section className="surface-card p-4">
              <h2 className="heading-sm mb-2 text-ink">Chưa tính được</h2>
              <ul className="grid gap-1 text-[13px] text-ink-secondary">
                {data.missing.map((reason) => (
                  <li key={reason}>{describeMissingReason(reason)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 2. VI SAO RA CON SO DO */}
          <section className="surface-card p-4">
            <h2 className="heading-sm mb-3 text-ink">Chi tiết</h2>
            <dl className="grid gap-2.5 text-[13px]">
              <MoneyRow
                label={
                  data.payAmount === null || data.payUnit === null
                    ? "Lương cơ bản"
                    : `Lương cơ bản (${formatVnd(data.payAmount)}/${PAY_RATE_UNIT_SUFFIX[data.payUnit]})`
                }
                amount={data.basePay}
              />
              {data.overtimePay !== 0 ? (
                <MoneyRow label="Tăng ca" amount={data.overtimePay} />
              ) : null}
              {data.hourAdjustment !== 0 ? (
                <MoneyRow label="Chênh lệch giờ công" amount={data.hourAdjustment} />
              ) : null}

              {data.allowanceItems.length > 0 ? (
                <>
                  <Divider label="Phụ cấp" />
                  {data.allowanceItems.map((item) => (
                    <MoneyRow
                      key={item.adjustmentId}
                      label={
                        item.multiplier === 1
                          ? item.name
                          : `${item.name} × ${formatNumber(item.multiplier)}`
                      }
                      amount={item.amount}
                    />
                  ))}
                </>
              ) : null}

              {data.deductionItems.length > 0 ? (
                <>
                  <Divider label="Khấu trừ" />
                  {data.deductionItems.map((item) => (
                    <MoneyRow
                      key={item.adjustmentId}
                      label={
                        item.multiplier === 1
                          ? item.name
                          : `${item.name} × ${formatNumber(item.multiplier)}`
                      }
                      // Khau tru luu la so DUONG o ban chot; dau tru la viec
                      // cua hien thi, khong phai cua du lieu.
                      amount={-item.amount}
                    />
                  ))}
                </>
              ) : null}

              <div className="mt-1 flex items-start justify-between gap-3 border-t border-hairline pt-2.5">
                <dt className="shrink-0 font-medium text-ink">Thực nhận</dt>
                <dd className="num text-right font-semibold text-ink">
                  {data.netPay === null ? "—" : formatVnd(data.netPay)}
                </dd>
              </div>
            </dl>
          </section>

          {/* 3. NGAY NAO RA BAO NHIEU — phan tra loi "hom do toi duoc bao
              nhieu", va tong cua no bang dung luong goc + tang ca + lech gio
              o khoi tren. */}
          <DailyPayList days={data.days} />

          {/* 4. SO LIEU CONG DA DUNG */}
          <section className="surface-card p-4">
            <h2 className="heading-sm mb-3 text-ink">Công của kỳ</h2>
            <dl className="grid gap-2.5 text-[13px]">
              <Row label="Ngày công" value={formatNumber(data.workedDays)} />
              <Row
                label="Tổng giờ làm"
                value={formatDurationShort(data.totalMinutes)}
              />
              <Row label="Ngày nghỉ" value={formatNumber(data.leaveDays)} />
              <Row label="Lần đi muộn" value={formatNumber(data.lateCount)} />
              <Row
                label="Giờ tăng ca"
                value={formatDurationShort(data.overtimeMinutes)}
              />
              <Row
                label="Giờ tăng ca quy đổi"
                value={
                  data.convertedOvertimeHours === null
                    ? "—"
                    : `${formatNumber(data.convertedOvertimeHours)} giờ`
                }
              />
            </dl>
            <p className="mt-3 text-[12px] text-ink-muted">
              {data.status === "closed"
                ? "Số liệu được chụp lại lúc chốt lương — sửa dữ liệu chấm công sau đó không làm đổi phiếu này."
                : "Số liệu tính lại mỗi lần mở — còn thay đổi cho tới khi doanh nghiệp chốt lương."}
            </p>
          </section>

          {/* Danh tinh tai thoi diem chot */}
          <section className="surface-card p-4">
            <dl className="grid gap-2.5 text-[13px]">
              <Row label="Nhân viên" value={data.employeeName} />
              <Row label="Mã nhân viên" value={data.employeeCode} numeric />
              <Row label="Phòng ban" value={data.departmentName ?? "—"} />
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function MoneyRow({
  label,
  amount,
}: {
  label: string;
  /** `null` = chua tinh duoc; hien gach ngang, TUYET DOI khong hien 0. */
  amount: number | null;
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="min-w-0 flex-1 text-ink-secondary">{label}</dt>
      <dd
        className={cn(
          "num shrink-0 text-right font-medium",
          amount !== null && amount < 0 ? "text-danger" : "text-ink",
        )}
      >
        {amount === null ? "—" : formatVnd(amount)}
      </dd>
    </div>
  );
}

function Divider({ label }: { label: string }): React.ReactElement {
  return (
    <p className="mt-1 border-t border-hairline pt-2.5 text-[12px] font-medium uppercase tracking-wide text-ink-muted">
      {label}
    </p>
  );
}

function Row({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "text-right font-medium text-ink",
          numeric && "num",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
