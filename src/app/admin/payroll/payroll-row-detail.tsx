"use client";

import * as React from "react";

import { DailyPayList } from "@/components/payroll/daily-pay-list";
import { PAYROLL_LABEL, describeMissingReason } from "@/lib/constants";
import { formatNumber, formatVnd } from "@/lib/format";
import type { PayrollPrepRow } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/**
 * Hang MO RONG cua mot dong bang luong.
 *
 * Tach khoi `payroll-view.tsx` khi bang chi tiet theo ngay duoc them vao: file
 * kia da hon 1.200 dong, va nhoi them mot bang nua se lam no khong con doc het
 * duoc trong mot lan. Chi tach dung phan dang phai sua — phan con lai cua
 * `payroll-view.tsx` giu nguyen.
 */

/**
 * So tien cua mot cot da bi rut, hoac cau noi VI SAO no chua co.
 *
 * `null` khong bao gio thanh 0 o day, y nhu tren bang: mot o `0` trong bang
 * luong doc nhu mot su that va nguoi ky duyet se ky.
 */
function describeMoney(
  value: number | null,
  missing: readonly string[],
  negative = false,
): string {
  if (value === null) {
    return missing.length > 0
      ? describeMissingReason(missing[0])
      : PAYROLL_LABEL.missingReasonFallback;
  }
  if (negative && value !== 0) return `−${formatVnd(value)}`;
  return formatVnd(value);
}

/** Phut -> gio, mot chu so thap phan. */
function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

/**
 * Cau mo ta CO SO TINH luong goc cua mot dong.
 *
 * Nguoi khai LUONG GIO duoc tra theo gio thuc te; nguoi khai luong thang/ngay
 * duoc tra theo ngay cong. Do la ly do hai dong co cung so ngay cong van ra
 * hai so tien khac nhau, va cau nay la cho duy nhat man hinh noi ra dieu do.
 */
function describeBasis(row: PayrollPrepRow): string {
  if (row.payUnit === "hour") {
    const hours = row.regularMinutes === null ? null : toHours(row.regularMinutes);
    return hours === null
      ? "—"
      : `${formatNumber(hours)} ${PAYROLL_LABEL.detailBasisHourSuffix}`;
  }
  return row.creditedDays === null
    ? "—"
    : `${formatNumber(row.creditedDays)} ${PAYROLL_LABEL.detailBasisDaySuffix}`;
}

/**
 * Khoi chi tiet cua mot dong luong: tung khoan phu cap va khau tru kem ten va
 * so tien, roi tien cua TUNG NGAY.
 *
 * Day la cho nguoi xem tra loi duoc "vi sao ra con so nay" ma khong phai hoi
 * ai — va la cho phep cong duoc bay ra tuong minh de doi chieu.
 */
export function PayrollRowDetail({
  row,
  showHourDelta = false,
}: {
  row: PayrollPrepRow;
  /**
   * Che do `shift_hourly` — chi o do cot "Lech gio so voi ca" moi co nghia.
   * Cung dieu kien voi cot cung ten tren bang, de hang mo rong khong noi mot
   * con so ma bang da co y khong noi.
   */
  showHourDelta?: boolean;
}): React.ReactElement {
  return (
    <div className="grid gap-4 border-t border-hairline px-4 py-4 md:grid-cols-3">
      <section>
        <h3 className="text-[13px] font-medium text-ink">
          {PAYROLL_LABEL.detailTitle}
        </h3>
        <dl className="mt-2 grid gap-1.5 text-[13px]">
          {/* CO SO TINH cua luong goc — dong nay tra loi "vi sao hai nguoi
              cung so ngay cong lai khac tien": nguoi khai luong gio duoc tra
              theo GIO THUC TE, nguoi khai luong thang/ngay theo NGAY CONG. */}
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-secondary">
              {PAYROLL_LABEL.detailBasisLabel}
            </dt>
            <dd className="num text-right text-ink">{describeBasis(row)}</dd>
          </div>
          <DetailRow label={PAYROLL_LABEL.detailBaseLabel} value={row.basePay} />
          <DetailRow
            label={PAYROLL_LABEL.detailOvertimeLabel}
            value={row.overtimePay}
          />
          {/* Nguoi co MUC TANG CA RIENG (0026): noi ro con so tang ca den tu
              dau, vi cot "Giờ quy đổi" cua ho van la con so theo he so CHUNG
              cua doanh nghiep — khong phai thu da tra tien cho ho. */}
          {row.overtimeRateValueType ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-secondary">
                {PAYROLL_LABEL.detailOvertimeRateLabel}
              </dt>
              <dd className="num text-right text-ink">
                {row.overtimeRateValueType === "fixed_hourly"
                  ? `${formatNumber(toHours(row.overtimeMinutes))} giờ × ${formatVnd(row.overtimeRateValue ?? 0)}`
                  : `${formatNumber(toHours(row.overtimeMinutes))} giờ × ${formatNumber(row.overtimeRateValue ?? 0)} × đơn giá giờ`}
              </dd>
            </div>
          ) : null}
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

      {/* CAC COT BI RUT o be ngang hep (spec 2026-08-29, phan 2 y 4).
          Duoi `lg` bang chi giu lai cot la can cu ra quyet dinh, va tat ca cot
          con lai ve day — KHONG bien mat. Tu `lg` tro len khoi nay khong ton
          tai: bang da hien du cot, va noi lai lan nua chi lam nhieu chu. */}
      <section className="lg:hidden md:col-span-3">
        <h3 className="text-[13px] font-medium text-ink">
          {PAYROLL_LABEL.detailOtherColumnsTitle}
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3">
          <OtherColumn
            label={PAYROLL_LABEL.departmentColumn}
            value={row.departmentName ?? "—"}
          />
          <OtherColumn
            label={PAYROLL_LABEL.creditedDaysColumn}
            value={
              row.creditedDays === null
                ? PAYROLL_LABEL.missingWorkModeInput
                : formatNumber(row.creditedDays)
            }
            tone={row.creditedDays === null ? "warning" : "default"}
          />
          <OtherColumn
            label={PAYROLL_LABEL.totalHoursColumn}
            value={formatNumber(toHours(row.totalMinutes))}
          />
          <OtherColumn
            label={PAYROLL_LABEL.overtimeColumn}
            value={formatNumber(toHours(row.overtimeMinutes))}
          />
          {showHourDelta ? (
            <OtherColumn
              label={PAYROLL_LABEL.hourDeltaColumn}
              value={formatNumber(toHours(row.hourDeltaMinutes))}
            />
          ) : null}
          <OtherColumn
            label={PAYROLL_LABEL.leaveColumn}
            value={formatNumber(row.leaveDays)}
          />
          {/* Di muon la NGOAI LE — no giu mau canh bao y nhu tren bang. */}
          <OtherColumn
            label={PAYROLL_LABEL.lateColumn}
            value={formatNumber(row.lateCount)}
            tone={row.lateCount > 0 ? "warning" : "default"}
          />
          {/* Chua tinh duoc thi noi THIEU GI, khong hien 0 — cung quy tac voi
              o tien tren bang. */}
          <OtherColumn
            label={PAYROLL_LABEL.allowanceColumn}
            value={describeMoney(row.allowanceTotal, row.missing)}
            tone={row.allowanceTotal === null ? "warning" : "default"}
          />
          <OtherColumn
            label={PAYROLL_LABEL.deductionColumn}
            value={describeMoney(row.deductionTotal, row.missing, true)}
            tone={row.deductionTotal === null ? "warning" : "default"}
          />
        </dl>
      </section>

      {/* CHI TIET THEO NGAY.
          Tong o day phai khop DUNG (Luong goc + Tang ca + Lech gio) o cot ben
          trai; neu hai con so lech nhau thi mot trong hai duong dang sai, va
          bang nay chinh la cho phat hien ra dieu do.

          `sticky left-0` + be rong gioi han: bang luong cuon NGANG (16 cot),
          nen mot khoi trai het chieu ngang se day cot tien cua no ra ngoai
          vung nhin — dung thu ma nguoi xem mo hang nay de doc. Ghim vao mep
          trai giu no doc duoc o moi vi tri cuon. */}
      {row.days.length > 0 ? (
        <div className="sticky left-0 max-w-2xl md:col-span-3">
          <DailyPayList days={row.days} />
        </div>
      ) : null}
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

/**
 * Mot cot cua bang da bi rut o be ngang hep.
 *
 * Nhan tren, con so duoi — cung khuon voi luoi tom tat o dau man hinh, de hai
 * cho khong day ra hai cach doc khac nhau cho cung mot loai du lieu.
 */
function OtherColumn({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  /** `warning`: con so nay la mot ngoai le hoac mot cho con thieu. */
  tone?: "default" | "warning";
}): React.ReactElement {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] tracking-wide text-ink-muted uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "num text-ink",
          tone === "warning" && "text-xs font-medium text-warning",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
