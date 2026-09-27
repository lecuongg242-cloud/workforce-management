import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { addDays, formatDate, formatDuration, minutesBetween } from "@/lib/format";

const TIME_PATTERN = /^\d{2}:\d{2}$/;

/**
 * Canh bao khi GIO RA sớm hơn GIO VAO — duong ghi hieu giờ ra la NGAY HOM SAU
 * (ca qua dem). KHONG chan: ca dem la truong hop that. Nhung o ca ngay, dieu
 * nay gan nhu luon la go nham (vd vao 17:55, ra 17:06 thanh mot luot 23 tieng
 * 11 phut, roi thanh tang ca), nen phai noi ro truoc khi luu.
 */
export function OvernightPunchWarning({
  date,
  checkIn,
  checkOut,
  isOvernightShift,
}: {
  /** "YYYY-MM-DD" — ngay cong cua luot */
  date: string;
  checkIn: string;
  checkOut: string | null;
  /** `null` khi chua chon ca */
  isOvernightShift: boolean | null;
}): React.ReactElement | null {
  if (!checkOut || !TIME_PATTERN.test(checkIn) || !TIME_PATTERN.test(checkOut)) {
    return null;
  }
  // Chuoi "HH:mm" so sanh duoc theo thu tu tu dien.
  if (checkOut >= checkIn) return null;

  const duration = minutesBetween(checkIn, checkOut);
  const nextDay = date ? formatDate(addDays(date, 1)) : "hôm sau";

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-control border border-warning-border bg-warning-soft px-3 py-2.5 text-[13px] text-warning"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="grid gap-1">
        <p>
          Giờ ra sớm hơn giờ vào nên sẽ được hiểu là{" "}
          <span className="num font-medium">
            {checkOut} ngày {nextDay}
          </span>{" "}
          — lượt này dài <span className="num font-medium">{formatDuration(duration)}</span>.
        </p>
        {isOvernightShift === false ? (
          <p>
            Ca này không phải ca đêm. Nếu nhân viên ra ca trong cùng ngày, hãy
            kiểm tra lại giờ vào và giờ ra.
          </p>
        ) : null}
      </div>
    </div>
  );
}
