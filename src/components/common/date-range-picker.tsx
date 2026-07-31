"use client";

import * as React from "react";
import { vi } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate, toIsoDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Bo chon ngay dung chung.
 *
 * Lam viec voi chuoi "YYYY-MM-DD" thay vi doi tuong Date de tranh lech mui gio;
 * khi mo lich moi chuyen tam sang Date theo UTC.
 */

function isoToDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function DateRangePicker({
  value,
  onChange,
  label = "Chọn ngày",
  align = "end",
  className,
  disabled = false,
}: {
  /** Ngay dang chon, dinh dang "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  align?: "start" | "center" | "end";
  className?: string;
  disabled?: boolean;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`${label}: ${formatDate(value)}`}
          disabled={disabled}
          className={cn("justify-start gap-2", className)}
        >
          <CalendarDays aria-hidden="true" />
          <span className="num">{formatDate(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <Calendar
          mode="single"
          locale={vi}
          defaultMonth={isoToDate(value)}
          selected={isoToDate(value)}
          onSelect={(date) => {
            if (!date) return;
            // Chuan hoa ve dau ngay theo UTC roi doi sang chuoi ISO
            onChange(
              toIsoDate(
                new Date(
                  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
                ),
              ),
            );
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/** Bo chon thang dang "◀ Tháng 07/2026 ▶" — dung o lich su cham cong */
export function MonthStepper({
  month,
  onChange,
  maxMonth,
  className,
}: {
  /** "YYYY-MM" */
  month: string;
  onChange: (month: string) => void;
  /** Khong cho vuot qua thang nay */
  maxMonth?: string;
  className?: string;
}): React.ReactElement {
  const shift = (amount: number): string => {
    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
    return `${next.getUTCFullYear()}-${`${next.getUTCMonth() + 1}`.padStart(2, "0")}`;
  };

  const nextMonth = shift(1);
  const canGoNext = maxMonth ? nextMonth <= maxMonth : true;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Tháng trước"
        onClick={() => onChange(shift(-1))}
      >
        <span aria-hidden="true">‹</span>
      </Button>
      <span className="num min-w-[118px] text-center text-sm font-medium text-ink">
        {`Tháng ${month.slice(5)}/${month.slice(0, 4)}`}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Tháng sau"
        disabled={!canGoNext}
        onClick={() => onChange(nextMonth)}
      >
        <span aria-hidden="true">›</span>
      </Button>
    </div>
  );
}
