"use client";

import * as React from "react";
import { vi } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate, pickedDateToIso } from "@/lib/format";
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
            onChange(pickedDateToIso(date));
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/** Mot khoang ngay dong, dang "YYYY-MM-DD". `from` luon nho hon hoac bang `to`. */
export interface DayRange {
  from: string;
  to: string;
}

/** So ngay cua mot thang "YYYY-MM" — lay ngay 0 cua thang ke tiep. */
function daysInMonthOf(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/** "2026-08-07" + "2026-08-09" -> "07–09/08"; cung mot ngay -> "07/08". */
function describeRange(range: DayRange): string {
  const month = range.from.slice(5, 7);
  const fromDay = range.from.slice(8);
  const toDay = range.to.slice(8);
  return range.from === range.to
    ? `${fromDay}/${month}`
    : `${fromDay}–${toDay}/${month}`;
}

/**
 * Loc theo KHOANG NGAY TRONG MOT THANG.
 *
 * VI SAO BI GIOI HAN TRONG THANG: moi duong doc du lieu cua man hinh nay deu
 * nhan mot tham so `month` — ban ghi cham cong, tong hop thang, va tien luong.
 * Rieng tien thi khong chi la chuyen ky thuat: luong duoc chot theo KY THANG,
 * nen mot khoang vat qua hai thang se lam con so tien khong con nghia gi.
 *
 * Vi vay lich luon mo o thang dang chon va chan moi ngay ngoai no — thay vi
 * cho chon roi im lang tra ve mot danh sach rong.
 */
export function DayRangeFilter({
  month,
  value,
  onChange,
  allLabel = "Toàn tháng",
  className,
}: {
  /** "YYYY-MM" — thang dang xem; lich khong cho ra ngoai thang nay. */
  month: string;
  /** `null` = khong loc. */
  value: DayRange | null;
  onChange: (value: DayRange | null) => void;
  allLabel?: string;
  className?: string;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  const firstDay = `${month}-01`;
  const lastDay = `${month}-${String(daysInMonthOf(month)).padStart(2, "0")}`;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={
              value ? `Đang lọc ${describeRange(value)}` : "Lọc theo khoảng ngày"
            }
            className="gap-1.5"
          >
            <CalendarDays aria-hidden="true" />
            <span className={cn(value && "num")}>
              {value ? describeRange(value) : allLabel}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            locale={vi}
            month={isoToDate(firstDay)}
            startMonth={isoToDate(firstDay)}
            endMonth={isoToDate(firstDay)}
            disabled={{ before: isoToDate(firstDay), after: isoToDate(lastDay) }}
            selected={
              value
                ? { from: isoToDate(value.from), to: isoToDate(value.to) }
                : undefined
            }
            onSelect={(next) => {
              if (!next?.from) {
                onChange(null);
                return;
              }
              // Chon mot dau thi khoang la DUNG ngay do, khong phai mot khoang
              // do dang: nguoi dung bam mot ngay va mong thay dung ngay ay.
              const from = pickedDateToIso(next.from);
              const to = next.to ? pickedDateToIso(next.to) : from;
              onChange({ from, to });
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      {/* Duong lui phai LUON THAY DUOC khi dang loc. Bo no di nghia la nguoi
          dung phai doan ra rang bam lai dung ngay dang chon se go loc — mot
          thao tac khong ai tu nghi ra. */}
      {value ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Xoá lọc ngày"
          onClick={() => onChange(null)}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
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
