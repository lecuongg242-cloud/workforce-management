"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AttendanceChartPoint } from "@/lib/types/domain";

/**
 * Bieu do cot 7 ngay gan nhat.
 * Mau lay tu he thong thuong hieu: indigo cho "da cham cong",
 * cam cho "di muon", xam cho "nghi" — khong dung mau neon.
 */

const SERIES = [
  { key: "present", label: "Đã chấm công", color: "#533afd" },
  { key: "late", label: "Đi muộn", color: "#f79009" },
  { key: "absent", label: "Nghỉ", color: "#cbd5e1" },
] as const;

interface TooltipEntry {
  dataKey?: string | number;
  value?: number;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}): React.ReactElement | null {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-control border border-hairline bg-white px-3 py-2 shadow-e2">
      <p className="num mb-1.5 text-[12px] font-medium text-ink">{label}</p>
      <ul className="grid gap-1">
        {SERIES.map((series) => {
          const entry = payload.find((item) => item.dataKey === series.key);
          return (
            <li
              key={series.key}
              className="flex items-center justify-between gap-4 text-[12px]"
            >
              <span className="flex items-center gap-1.5 text-ink-secondary">
                <span
                  aria-hidden="true"
                  className="inline-block size-2 rounded-[2px]"
                  style={{ backgroundColor: series.color }}
                />
                {series.label}
              </span>
              <span className="num font-medium text-ink">{entry?.value ?? 0}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AttendanceChart({
  data,
}: {
  data: AttendanceChartPoint[];
}): React.ReactElement {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
          barGap={2}
          barCategoryGap="22%"
        >
          <CartesianGrid vertical={false} stroke="#e3e8ee" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#64748d", fontSize: 11, className: "num" }}
            tickMargin={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: "#64748d", fontSize: 11, className: "num" }}
            width={38}
          />
          <Tooltip
            cursor={{ fill: "rgba(83, 58, 253, 0.06)" }}
            content={<ChartTooltip />}
          />
          <Legend
            verticalAlign="bottom"
            height={32}
            iconType="square"
            iconSize={9}
            formatter={(value: string) => (
              <span className="text-[12px] text-ink-secondary">{value}</span>
            )}
          />
          {SERIES.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              fill={series.color}
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
