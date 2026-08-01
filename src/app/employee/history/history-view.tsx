"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CalendarX2 } from "lucide-react";

import { MonthStepper } from "@/components/common/date-range-picker";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { MonthSummary } from "@/components/employee-app/month-summary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { WEEKDAY_LABEL } from "@/lib/constants";
import { getMonthlySummary, listAttendance } from "@/lib/data/attendance";
import { listShifts } from "@/lib/data/shifts";
import {
  formatDate,
  formatDurationShort,
  formatTime,
  getWeekday,
} from "@/lib/format";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/** Mau cham trang thai tren dai lich */
const dotClass: Record<AttendanceStatus, string> = {
  on_time: "bg-success",
  late: "bg-warning",
  early_leave: "bg-warning",
  missing_checkout: "bg-danger",
  leave_paid: "bg-info",
  leave_unpaid: "bg-danger",
  day_off: "bg-neutral-border",
};

export function HistoryView({ month: initialMonth }: { month: string }): React.ReactElement {
  const session = useAuthenticatedSession();
  const employeeId = session.user.employeeId;
  const [month, setMonth] = React.useState(initialMonth);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  const { data, isLoading, error, reload } = useDataQuery(
    async () => {
      const [records, summary, shifts] = await Promise.all([
        listAttendance({ companyId: session.companyId, employeeId, month }),
        getMonthlySummary(session.companyId, employeeId, month),
        listShifts(session.companyId),
      ]);
      return { records, summary, shifts };
    },
    [session.companyId, employeeId, month],
  );

  const shiftNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    data?.shifts.forEach((shift) => {
      map[shift.id] = shift.name;
    });
    return map;
  }, [data]);

  const visibleRecords = React.useMemo(() => {
    if (!data) return [];
    return selectedDate
      ? data.records.filter((record) => record.date === selectedDate)
      : data.records;
  }, [data, selectedDate]);

  // Doi thang thi bo chon ngay
  React.useEffect(() => {
    setSelectedDate(null);
  }, [month]);

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="display-md text-ink">Lịch sử chấm công</h1>
      </header>

      <div className="surface-card flex items-center justify-center p-2">
        <MonthStepper month={month} onChange={setMonth} maxMonth={initialMonth} />
      </div>

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : isLoading || !data ? (
        <>
          <Skeleton className="h-20 w-full rounded-card" />
          <Skeleton className="h-36 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </>
      ) : (
        <>
          {/* Dai lich cuon ngang */}
          {data.records.length > 0 ? (
            <section
              aria-label="Chọn ngày để lọc"
              className="no-scrollbar -mx-4 overflow-x-auto px-4"
            >
              <div className="flex gap-1.5">
                {[...data.records]
                  .sort((a, b) => (a.date < b.date ? -1 : 1))
                  .map((record) => {
                    const isSelected = selectedDate === record.date;
                    const weekday = getWeekday(record.date);
                    return (
                      <button
                        key={record.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          setSelectedDate(isSelected ? null : record.date)
                        }
                        className={cn(
                          "flex min-h-[64px] w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-control border transition-colors",
                          isSelected
                            ? "border-brand bg-brand-wash"
                            : "border-hairline bg-white",
                        )}
                      >
                        <span className="text-[10px] leading-none text-ink-muted">
                          {WEEKDAY_LABEL[weekday]}
                        </span>
                        <span className="num text-[15px] leading-none font-medium text-ink">
                          {record.date.slice(8)}
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-1.5 rounded-full",
                            dotClass[record.status],
                          )}
                        />
                      </button>
                    );
                  })}
              </div>
            </section>
          ) : null}

          <MonthSummary summary={data.summary} title="Tổng hợp tháng" />

          <section>
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="heading-sm text-ink">
                {selectedDate ? `Ngày ${formatDate(selectedDate)}` : "Theo ngày"}
              </h2>
              {selectedDate ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(null)}
                >
                  Xem cả tháng
                </Button>
              ) : null}
            </div>

            {visibleRecords.length === 0 ? (
              <div className="surface-card">
                <EmptyState
                  icon={CalendarX2}
                  title="Chưa có dữ liệu chấm công"
                  description="Tháng này chưa ghi nhận ngày công nào."
                  compact
                />
              </div>
            ) : (
              <ul className="grid gap-2.5">
                {visibleRecords.map((record) => (
                  <AttendanceItem
                    key={record.id}
                    record={record}
                    shiftName={shiftNames[record.shiftId] ?? "—"}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function AttendanceItem({
  record,
  shiftName,
}: {
  record: AttendanceRecord;
  shiftName: string;
}): React.ReactElement {
  const weekday = getWeekday(record.date);

  return (
    <li className="surface-card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="num text-[15px] font-medium text-ink">
            {formatDate(record.date)}
          </p>
          <p className="text-[13px] text-ink-muted">
            {WEEKDAY_LABEL[weekday]} · {shiftName}
          </p>
        </div>
        <StatusBadge kind="attendance" value={record.status} size="sm" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniCell label="Giờ vào" value={formatTime(record.checkIn)} />
        <MiniCell label="Giờ ra" value={formatTime(record.checkOut)} />
        <MiniCell
          label="Tổng giờ"
          value={
            record.workedMinutes > 0
              ? formatDurationShort(record.workedMinutes)
              : "—"
          }
        />
      </div>

      {record.needsSupplement ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-control border border-warning-border bg-warning-soft px-3 py-2">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
            <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
            Cần bổ sung chấm công
          </p>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/employee/requests?type=attendance_supplement">
              Tạo yêu cầu
            </Link>
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function MiniCell({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="rounded-control border border-hairline bg-canvas-soft px-2.5 py-2">
      <p className="text-[10px] leading-tight text-ink-muted">{label}</p>
      <p className="num mt-0.5 text-[14px] leading-tight font-medium text-ink">
        {value}
      </p>
    </div>
  );
}
