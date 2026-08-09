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
          "rounded-control bg-canvas-soft px-3 py-2.5 text-[12px] text-ink-muted",
          className,
        )}
      >
        {DAY_PAY_LABEL.inProgress}
      </p>
    );
  }

  return (
    /* NEN MO NHAT thay cho mot duong ke: khoi tien la KET LUAN cua the ngay,
       va mot mang nen tach no ra khoi phan gio giac ma mat khong phai doc chu
       moi biet minh dang xem vung nao. */
    <dl
      className={cn(
        "grid gap-1.5 rounded-control bg-canvas-soft px-3 py-2.5 text-[12px]",
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
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        strong && "mt-0.5 border-t border-hairline pt-2",
      )}
    >
      <dt className={cn("text-ink-muted", strong && "font-medium text-ink")}>
        {label}
      </dt>
      {/* CON SO CUOI to hon va mang mau thuong hieu. Day la cau tra loi cua ca
          the ngay; de no cung co cung mau voi hai dong cong o tren thi khong
          co gi noi cho nguoi doc biet dong nao la ket luan.

          Mau chi dung cho TIEN, khong dung cho gio — mot man hinh to mau moi
          thu quan trong thi khong con thu nao quan trong. */}
      <dd
        className={cn(
          "num shrink-0 text-right",
          strong
            ? "text-[17px] leading-none font-semibold"
            : "text-[13px] font-medium",
          amount === null
            ? "text-ink-muted"
            : amount < 0
              ? "text-danger"
              : strong
                ? "text-brand"
                : "text-ink",
        )}
      >
        {amount === null ? "—" : formatVnd(amount)}
      </dd>
    </div>
  );
}
