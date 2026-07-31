import * as React from "react";

import { formatDurationShort, formatMonthLabel, formatNumber } from "@/lib/format";
import type { MonthlySummary } from "@/lib/types/domain";

/** Bon o tong hop cong trong thang */
export function MonthSummary({
  summary,
  title,
}: {
  summary: MonthlySummary;
  title?: string;
}): React.ReactElement {
  const items = [
    { label: "Ngày công", value: formatNumber(summary.workedDays) },
    { label: "Tổng giờ làm", value: formatDurationShort(summary.totalMinutes) },
    { label: "Đi muộn", value: `${formatNumber(summary.lateCount)} lần` },
    { label: "Nghỉ phép", value: `${formatNumber(summary.leaveDays)} ngày` },
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
    </section>
  );
}
