import * as React from "react";

import { DAY_PAY_LABEL } from "@/lib/constants";
import { formatVnd } from "@/lib/format";
import type { PayrollDayLine } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/**
 * TIEN CUA MOT NGAY, TACH LAM TUNG KHOAN.
 *
 * `DailyPayList` tra loi "ngay do bao nhieu"; khoi nay tra loi cau tiep theo —
 * "bao nhieu la luong co ban, bao nhieu la tang ca". Hai cau khac nhau nen la
 * hai component, nhung ca hai deu doc CUNG mot `PayrollDayLine`, nen khong noi
 * nao co the hien ra mot con so ma noi kia khong biet.
 *
 * Component THUAN TRINH BAY: khong nap du lieu, khong cong lai, khong lam tron.
 * `dayTotal` LAY THANG tu du lieu chu khong cong ba dong o tren — cong lai o
 * day la mo duong cho mot khoi tu mau thuan voi chinh phieu luong khi mot thanh
 * phan doi cach lam tron.
 *
 * BA TINH HUONG KHONG DUOC GOP — cung quy tac voi `DailyPayList`:
 *
 *   dang do      -> mot nhan, KHONG phai so 0. "Hom nay toi duoc 0 đ" la mot
 *                   cau sai ma man hinh khong duoc phep noi.
 *   thieu du kien -> gach ngang. Con so LE RA phai co nhung chua tinh duoc.
 *   co so        -> so tien.
 */
export function DayPayBreakdown({
  day,
  className,
}: {
  day: PayrollDayLine;
  className?: string;
}): React.ReactElement {
  if (day.state === "in_progress") {
    return (
      <p
        className={cn(
          "border-t border-hairline pt-2.5 text-[12px] text-ink-muted",
          className,
        )}
      >
        {DAY_PAY_LABEL.inProgress}
      </p>
    );
  }

  return (
    <dl
      className={cn(
        "grid gap-1.5 border-t border-hairline pt-2.5 text-[12px]",
        className,
      )}
    >
      <AmountRow label={DAY_PAY_LABEL.basePay} amount={day.basePay} />
      <AmountRow label={DAY_PAY_LABEL.overtimePay} amount={day.overtimePay} />
      {/* Chi hien khi KHAC 0 (che do `shift_hourly`) — bo qua no khi khac 0 se
          lam ba dong khong cong lai thanh "Ca ngay", va nguoi doc se tuong mot
          trong bon con so bi sai. */}
      {day.hourAdjustment !== null && day.hourAdjustment !== 0 ? (
        <AmountRow
          label={DAY_PAY_LABEL.hourAdjustment}
          amount={day.hourAdjustment}
        />
      ) : null}
      <AmountRow label={DAY_PAY_LABEL.dayTotal} amount={day.dayTotal} strong />
    </dl>
  );
}

function AmountRow({
  label,
  amount,
  strong = false,
}: {
  label: string;
  /** `null` = chua tinh duoc; hien gach ngang, TUYET DOI khong hien 0. */
  amount: number | null;
  strong?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className={cn("text-ink-muted", strong && "font-medium text-ink")}>
        {label}
      </dt>
      <dd
        className={cn(
          "num shrink-0 text-right font-medium",
          amount !== null && amount < 0 ? "text-danger" : "text-ink",
          strong && "font-semibold",
        )}
      >
        {amount === null ? "—" : formatVnd(amount)}
      </dd>
    </div>
  );
}
