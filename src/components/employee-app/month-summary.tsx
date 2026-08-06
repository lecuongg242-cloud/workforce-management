import * as React from "react";

import { OVERTIME_DISCLAIMER, OVERTIME_DISPLAY_LABEL } from "@/lib/constants";
import { formatDurationShort, formatMonthLabel, formatNumber } from "@/lib/format";
import type { MonthlySummary } from "@/lib/types/domain";

/**
 * Bon o tong hop cong trong thang, cong hai o tang ca khi duong doc co mang
 * so lieu quy doi (SET-04, plan 04-05).
 *
 * QUY TAC KHONG DUOC PHA: khi `convertedOvertimeHours` la `null` (doanh
 * nghiep chua khai he so — D-26) thi o "Quy doi" hien "Chua khai he so", KHONG
 * hien so 0. So 0 noi voi nhan vien rang ho khong co gio tang ca nao, khac han
 * voi "he thong chua biet quy doi the nao".
 */
export function MonthSummary({
  summary,
  title,
}: {
  summary: MonthlySummary;
  title?: string;
}): React.ReactElement {
  const overtimeMinutes = summary.overtimeMinutes ?? 0;
  const hasOvertimeData = summary.overtimeMinutes !== undefined;
  const converted = summary.convertedOvertimeHours;

  const items = [
    { label: "Ngày công", value: formatNumber(summary.workedDays) },
    { label: "Tổng giờ làm", value: formatDurationShort(summary.totalMinutes) },
    { label: "Đi muộn", value: `${formatNumber(summary.lateCount)} lần` },
    { label: "Nghỉ phép", value: `${formatNumber(summary.leaveDays)} ngày` },
    ...(hasOvertimeData
      ? [
          {
            label: OVERTIME_DISPLAY_LABEL.overtimeRawLabel,
            value:
              overtimeMinutes > 0 ? formatDurationShort(overtimeMinutes) : "—",
          },
          {
            label: OVERTIME_DISPLAY_LABEL.overtimeConvertedLabel,
            value:
              converted === null || converted === undefined
                ? OVERTIME_DISPLAY_LABEL.notDeclared
                : `${formatNumber(converted)} giờ`,
          },
        ]
      : []),
  ];

  return (
    <section className="surface-card p-4">
      <h2 className="heading-sm text-ink">
        {title ?? formatMonthLabel(summary.month)}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-2.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-control border border-hairline bg-canvas-soft px-3 py-2.5"
          >
            <dt className="text-[11px] leading-tight text-ink-muted">
              {item.label}
            </dt>
            <dd className="num mt-1 text-[17px] leading-tight font-medium text-ink">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {/* Gioi han D-28a noi bang chu ngay canh con so, khong de nguoi doc tu
          suy ra: con so nay la SO LIEU CONG, chua phai can cu tra luong. */}
      {hasOvertimeData ? (
        <p className="mt-2.5 text-[11px] leading-snug text-ink-muted">
          {OVERTIME_DISCLAIMER}
        </p>
      ) : null}
    </section>
  );
}
