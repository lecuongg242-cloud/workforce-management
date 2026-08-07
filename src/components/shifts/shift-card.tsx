"use client";

import * as React from "react";
import {
  Coffee,
  Copy,
  MoonStar,
  MoreHorizontal,
  Pencil,
  Timer,
  Users,
} from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WEEKDAY_LABEL } from "@/lib/constants";
import { formatDuration, formatNumber, minutesBetween } from "@/lib/format";
import type { ShiftWithStats } from "@/lib/data/shifts";

/** The hien thi mot ca lam viec */
export function ShiftCard({
  shift,
  onEdit,
  onDuplicate,
  onArchive,
}: {
  shift: ShiftWithStats;
  onEdit: (shift: ShiftWithStats) => void;
  onDuplicate: (shift: ShiftWithStats) => void;
  onArchive: (shift: ShiftWithStats) => void;
}): React.ReactElement {
  const workingMinutes = Math.max(
    minutesBetween(shift.startTime, shift.endTime) - shift.breakMinutes,
    0,
  );

  return (
    <article className="surface-card flex flex-col p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="heading-sm text-ink">{shift.name}</h2>
            <span className="num rounded-full bg-canvas-soft px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
              {shift.code}
            </span>
          </div>
          <p className="num display-md mt-2 text-ink">
            {shift.startTime} – {shift.endTime}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Hành động cho ${shift.name}`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-canvas-soft hover:text-ink"
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => onEdit(shift)}>
              <Pencil aria-hidden="true" />
              Chỉnh sửa
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDuplicate(shift)}>
              <Copy aria-hidden="true" />
              Nhân bản ca
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={shift.status === "archived"}
              onSelect={() => onArchive(shift)}
            >
              Ngừng sử dụng
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {shift.overnight ? (
          <StatusBadge
            kind="custom"
            label="Ca qua đêm"
            tone="info"
            icon={MoonStar}
            size="sm"
          />
        ) : null}
        <StatusBadge kind="shift" value={shift.status} size="sm" />
      </div>

      <dl className="mt-4 grid gap-2.5 text-[13px]">
        <div className="flex items-center gap-2 text-ink-secondary">
          <Timer aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          <dt className="sr-only">Thời gian làm việc thực tế</dt>
          <dd className="num">{formatDuration(workingMinutes)} làm việc</dd>
        </div>
        <div className="flex items-center gap-2 text-ink-secondary">
          <Coffee aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          <dt className="sr-only">Giờ nghỉ</dt>
          {/* Khung gio noi duoc dieu ma con so phut khong noi duoc: nghi LUC
              MAY GIO. Ca chua khai khung gio (truoc 0025) lui ve so phut —
              khong bia ra mot khung gio. */}
          <dd className="num">
            {shift.breakStartTime && shift.breakEndTime
              ? `Nghỉ ${shift.breakStartTime}–${shift.breakEndTime}`
              : shift.breakMinutes > 0
                ? `Nghỉ ${shift.breakMinutes} phút (chưa có khung giờ)`
                : "Không có giờ nghỉ"}
          </dd>
        </div>
        <div className="flex items-center gap-2 text-ink-secondary">
          <Users aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          <dt className="sr-only">Số nhân viên đang áp dụng</dt>
          <dd className="num">
            {formatNumber(shift.employeeCount)} nhân viên đang áp dụng
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-hairline pt-3">
        <p className="text-xs text-ink-muted">
          Cho phép đi muộn{" "}
          <span className="num font-medium text-ink">
            {shift.lateToleranceMinutes} phút
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
            const isWorking = shift.workingDays.includes(day);
            return (
              <span
                key={day}
                title={isWorking ? "Ngày làm việc" : "Ngày nghỉ"}
                className={
                  isWorking
                    ? "num inline-flex size-6 items-center justify-center rounded-full bg-brand-wash text-[10px] font-medium text-brand-deep"
                    : "num inline-flex size-6 items-center justify-center rounded-full bg-canvas-soft text-[10px] text-ink-muted"
                }
              >
                {WEEKDAY_LABEL[day]}
              </span>
            );
          })}
        </div>
      </div>
    </article>
  );
}
