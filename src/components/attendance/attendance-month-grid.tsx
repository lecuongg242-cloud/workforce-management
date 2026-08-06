"use client";

import * as React from "react";

import {
  ADMIN_ATTENDANCE_LABEL,
  ATTENDANCE_GRID_SYMBOL,
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_TONE,
  WEEKDAY_LABEL,
  type SemanticTone,
} from "@/lib/constants";
import { isoWeekday } from "@/lib/attendance/classification";
import { formatDate, formatNumber, listMonthDates } from "@/lib/format";
import type { AttendanceDay } from "@/lib/attendance/day";
import type { AttendanceStatus, Employee } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/**
 * Luoi thang: mot dong cho moi nhan vien, mot cot cho moi ngay.
 *
 * KY HIEU LA CHU, MAU CHI LA LOP THU HAI. Mot o chi to mau vo nghia voi nguoi
 * mu mau va bien mat khi in ra giay — ma bang cong thi hay duoc in ra de ky.
 * Moi o con mang `title` day du ("Nguyen Minh Anh · 03/08/2026 · Di muon") de
 * nguoi dung trinh doc man hinh nghe duoc dieu ma con mat doc duoc.
 *
 * O trong nghia la KHONG CO BAN GHI — khac han mot ngay nghi da khai. Hai thu
 * do khong duoc trong giong nhau: mot ben la du lieu vang, mot ben la du lieu
 * noi rang nguoi do duoc nghi.
 */

const toneClass: Record<SemanticTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-neutral-soft text-neutral-ink",
  brand: "bg-brand-wash text-brand-deep",
};

/** Cac trang thai xuat hien trong chu giai, theo thu tu doc de hieu. */
const LEGEND_STATUSES: AttendanceStatus[] = [
  "on_time",
  "late",
  "early_leave",
  "missing_checkout",
  "leave_paid",
  "leave_unpaid",
];

export interface GridRow {
  employee: Employee;
  /** Ngay cong da gop, tra khoa theo "YYYY-MM-DD". */
  daysByDate: Map<string, AttendanceDay>;
  workedDays: number;
}

export function AttendanceMonthGrid({
  month,
  rows,
  onOpenRecord,
}: {
  /** "YYYY-MM" */
  month: string;
  rows: GridRow[];
  /** Mo bang chung cua mot luot cham cong; `null` khi ngay do khong co luot nao. */
  onOpenRecord: (recordId: string) => void;
}): React.ReactElement {
  const dates = React.useMemo(() => listMonthDates(month), [month]);

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline bg-canvas-soft">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-canvas-soft px-3 py-2 text-left text-xs font-medium text-ink-muted"
              >
                {ADMIN_ATTENDANCE_LABEL.employeeColumn}
              </th>
              {dates.map((date) => {
                const weekday = isoWeekday(date);
                const isWeekend = weekday === 6 || weekday === 7;
                return (
                  <th
                    key={date}
                    scope="col"
                    className={cn(
                      "num w-8 px-0 py-2 text-center text-[11px] font-medium",
                      isWeekend ? "text-ink-muted" : "text-ink-secondary",
                    )}
                  >
                    <span className="block">{date.slice(8)}</span>
                    <span className="block text-[10px] font-normal text-ink-muted">
                      {WEEKDAY_LABEL[weekday]}
                    </span>
                  </th>
                );
              })}
              <th
                scope="col"
                className="px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-ink-muted"
              >
                {ADMIN_ATTENDANCE_LABEL.totalColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employee.id} className="border-b border-hairline last:border-b-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[14rem] bg-white px-3 py-2 text-left font-normal"
                >
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {row.employee.fullName}
                  </span>
                  <span className="num block text-[11px] text-ink-muted">
                    {row.employee.code}
                  </span>
                </th>

                {dates.map((date) => {
                  const day = row.daysByDate.get(date);
                  if (!day) {
                    return (
                      <td key={date} className="px-0 py-1 text-center">
                        <span
                          className="inline-flex size-6 items-center justify-center text-ink-muted/50"
                          title={`${row.employee.fullName} · ${formatDate(date)} · ${ADMIN_ATTENDANCE_LABEL.noRecordCell}`}
                        >
                          –
                        </span>
                      </td>
                    );
                  }

                  const label = ATTENDANCE_STATUS_LABEL[day.status];
                  const firstPunchId = day.punches[0]?.id ?? null;
                  const cell = (
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-[6px] text-[11px] font-semibold",
                        toneClass[ATTENDANCE_STATUS_TONE[day.status]],
                      )}
                    >
                      {ATTENDANCE_GRID_SYMBOL[day.status]}
                    </span>
                  );

                  return (
                    <td key={date} className="px-0 py-1 text-center">
                      {firstPunchId ? (
                        <button
                          type="button"
                          onClick={() => onOpenRecord(firstPunchId)}
                          title={`${row.employee.fullName} · ${formatDate(date)} · ${label} — ${ADMIN_ATTENDANCE_LABEL.openDetail}`}
                          className="rounded-[6px] focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          {cell}
                          <span className="sr-only">
                            {`${row.employee.fullName} ${formatDate(date)} ${label}`}
                          </span>
                        </button>
                      ) : (
                        // Ngay nghi phep khong co luot nao — khong co bang
                        // chung de mo, nen khong dung nut (mot nut khong lam
                        // gi la mot loi hua sai).
                        <span title={`${row.employee.fullName} · ${formatDate(date)} · ${label}`}>
                          {cell}
                        </span>
                      )}
                    </td>
                  );
                })}

                <td className="num px-3 py-2 text-right font-medium whitespace-nowrap text-ink">
                  {formatNumber(row.workedDays)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline px-3 py-3 text-xs text-ink-muted">
        <span className="font-medium text-ink-secondary">
          {ADMIN_ATTENDANCE_LABEL.legendTitle}:
        </span>
        {LEGEND_STATUSES.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-[6px] text-[11px] font-semibold",
                toneClass[ATTENDANCE_STATUS_TONE[status]],
              )}
            >
              {ATTENDANCE_GRID_SYMBOL[status]}
            </span>
            {ATTENDANCE_STATUS_LABEL[status]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-5 items-center justify-center text-ink-muted/50">
            –
          </span>
          {ADMIN_ATTENDANCE_LABEL.noRecordCell}
        </span>
      </div>
    </div>
  );
}
