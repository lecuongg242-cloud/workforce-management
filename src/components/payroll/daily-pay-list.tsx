import * as React from "react";

import { EmptyState } from "@/components/common/empty-state";
import { DAY_TYPE_LABEL, PAYSLIP_DAILY_LABEL } from "@/lib/constants";
import { formatDate, formatNumber, formatVnd } from "@/lib/format";
import type { PayrollDayLine } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

/**
 * Danh sach TIEN THEO NGAY.
 *
 * Dung o CA HAI man hinh — phieu luong cua nhan vien va hang mo rong cua bang
 * luong quan tri. Mot cach trinh bay duy nhat cho mot khai niem duy nhat: neu
 * hai man hinh tu ve bang cua rieng minh, mot ngay se hien "0 đ" o cho nay va
 * "Đang diễn ra" o cho kia, va khong ai biet ben nao dung.
 *
 * Component THUAN TRINH BAY: khong tu nap du lieu, khong tinh lai con so nao.
 * Tong o chan bang duoc CONG TAI DAY tu chinh nhung o hien ra ngay tren — do
 * la thu lam bang doi chieu duoc, va no bang dung `basePay + overtimePay +
 * hourAdjustment` cua ky (xem quy tac (3) o `compute.ts`).
 */
export function DailyPayList({
  days,
  className,
}: {
  days: readonly PayrollDayLine[];
  className?: string;
}): React.ReactElement {
  // Ngay dang do khong gop gi — cung quy tac voi `sumDailyPay()`.
  const total = days.reduce((sum, day) => sum + (day.dayTotal ?? 0), 0);

  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      <header className="border-b border-hairline px-4 py-3">
        <h2 className="heading-sm text-ink">
          {PAYSLIP_DAILY_LABEL.sectionTitle}
        </h2>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          {PAYSLIP_DAILY_LABEL.sectionHint}
        </p>
      </header>

      {days.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={PAYSLIP_DAILY_LABEL.emptyTitle}
          description={PAYSLIP_DAILY_LABEL.emptyBody}
        />
      ) : (
        <>
          <ul className="divide-y divide-hairline">
            {days.map((day) => (
              <li
                key={day.date}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="num text-[13px] text-ink">
                    {formatDate(day.date)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    {describeDay(day)}
                  </p>
                </div>
                <DayAmount day={day} />
              </li>
            ))}
          </ul>

          <footer className="flex items-center justify-between gap-3 border-t border-hairline bg-canvas-soft px-4 py-2.5">
            <span className="text-[13px] font-medium text-ink">
              {PAYSLIP_DAILY_LABEL.totalRow}
            </span>
            <span className="num text-[14px] font-semibold text-ink">
              {formatVnd(total)}
            </span>
          </footer>
        </>
      )}
    </section>
  );
}

/**
 * Loai ngay, gio lam, gio tang ca — phan giai thich cho con so ben phai.
 *
 * NGAY NGHI duoc goi ten TRUOC loai ngay. Neu chi hien loai ngay, mot ngay
 * nghi co phep se doc y het mot ngay thuong khong co gio lam ("Ngày thường",
 * khong so gio) trong khi no VAN duoc tra tron mot ngay cong — va nguoi xem se
 * thay mot con so tien khong giai thich duoc.
 */
function describeDay(day: PayrollDayLine): string {
  const parts: string[] = [];

  if (day.state === "leave_paid") parts.push(PAYSLIP_DAILY_LABEL.leavePaid);
  else if (day.state === "leave_unpaid") {
    parts.push(PAYSLIP_DAILY_LABEL.leaveUnpaid);
  }

  parts.push(DAY_TYPE_LABEL[day.dayType]);

  if (day.regularMinutes !== null && day.regularMinutes > 0) {
    parts.push(
      `${formatNumber(day.regularMinutes / 60)} ${PAYSLIP_DAILY_LABEL.hourSuffix}`,
    );
  }
  if (day.overtimeMinutes > 0) {
    parts.push(
      `${PAYSLIP_DAILY_LABEL.overtimePrefix} ${formatNumber(day.overtimeMinutes / 60)} ${PAYSLIP_DAILY_LABEL.hourSuffix}`,
    );
  }
  return parts.join(" · ");
}

/**
 * BA cach hien khac nhau cho ba tinh huong khac nhau — va chung khong duoc gop:
 *
 *   dang do    -> mot nhan, KHONG phai so 0. "Hom nay toi duoc 0 đ" la mot cau
 *                 sai ma man hinh khong duoc phep noi.
 *   thieu du kien -> mot gach ngang. Con so LE RA phai co nhung chua tinh duoc.
 *   co so      -> so tien.
 */
function DayAmount({ day }: { day: PayrollDayLine }): React.ReactElement {
  if (day.state === "in_progress") {
    return (
      <span className="shrink-0 text-[12px] text-ink-muted">
        {PAYSLIP_DAILY_LABEL.inProgress}
      </span>
    );
  }

  if (day.dayTotal === null) {
    return (
      <span className="num shrink-0 text-[14px] text-ink-muted">—</span>
    );
  }

  return (
    <span
      className={cn(
        "num shrink-0 text-[14px] font-medium",
        day.dayTotal < 0 ? "text-danger" : "text-ink",
      )}
    >
      {formatVnd(day.dayTotal)}
    </span>
  );
}
