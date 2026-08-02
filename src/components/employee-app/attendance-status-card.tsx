"use client";

import * as React from "react";
import { LogIn, LogOut, MapPin, Timer } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  formatDuration,
  formatTime,
  minutesBetween,
  minutesToTime,
} from "@/lib/format";
import type { AttendanceRecord, CheckInState, Shift } from "@/lib/types/domain";

/**
 * The cham cong voi ba trang thai: chua vao ca, dang lam viec, da tan ca.
 *
 * Dong ho chi bat dau chay sau khi component gan vao DOM de markup cua may chu
 * va trinh duyet khong lech nhau (tranh loi hydration).
 */
export function AttendanceStatusCard({
  state,
  record,
  shift,
  isPending,
  onCheckIn,
  onCheckOut,
  canCheckInRemotely,
}: {
  state: CheckInState;
  record: AttendanceRecord | null;
  shift: Shift | null;
  isPending: boolean;
  /**
   * Khong con nhan tham so `time`: bam "Vào ca" chi MO Camera Sheet (plan
   * 03-01) — dau thoi gian that su do server cap TRONG luc gui bang chung,
   * khong phai do dong ho client tai thoi diem bam nut.
   */
  onCheckIn: () => void;
  onCheckOut: (time: string) => void;
  canCheckInRemotely: boolean;
}): React.ReactElement {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    // Dong ho THAT, khoi tao SAU khi component gan vao DOM (useEffect,
    // khong phai lan ve dau tien) nen khong gay lech hydration; day la
    // ngoai le hop le duy nhat da biet cua D-19a, ghi tu 02-08.
    // eslint-disable-next-line timeflow/no-date-in-client
    setNow(new Date());
    const timer = setInterval(
      // eslint-disable-next-line timeflow/no-date-in-client -- xem ly do o tren: dong ho tick that, khong dung cho "hom nay" cua du lieu.
      () => setNow(new Date()),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  const clock = now
    ? `${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}`
    : "--:--";
  const seconds = now ? `${now.getSeconds()}`.padStart(2, "0") : "--";

  /* ------------------------------------------------ Da ket thuc ca */
  if (state === "finished" && record) {
    const badge =
      record.status === "late"
        ? ("late" as const)
        : record.status === "early_leave"
          ? ("early_leave" as const)
          : ("on_time" as const);

    return (
      <section className="surface-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="heading-sm text-ink">Ca làm hôm nay đã kết thúc</h2>
          <StatusBadge kind="attendance" value={badge} size="sm" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <TimeBlock label="Giờ vào" value={formatTime(record.checkIn)} />
          <TimeBlock label="Giờ ra" value={formatTime(record.checkOut)} />
          <TimeBlock
            label="Tổng thời gian"
            value={formatDuration(record.workedMinutes)}
            emphasis
          />
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[13px] text-ink-muted">
          <MapPin aria-hidden="true" className="size-3.5" />
          {record.location}
        </p>
      </section>
    );
  }

  /* ------------------------------------------------ Dang lam viec */
  if (state === "working" && record?.checkIn) {
    // Neu dong ho hien tai som hon gio vao ca (nguoi dung xem thu vao ban dem),
    // minutesBetween se vong qua ngay — khi do coi nhu vua bat dau ca.
    const elapsed = now ? minutesBetween(record.checkIn, clock) : 0;
    const workedMinutes = elapsed > 16 * 60 ? 0 : elapsed;

    return (
      <section className="surface-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="heading-sm text-ink">Đang làm việc</h2>
          <StatusBadge
            kind="custom"
            label="Đang trong ca"
            tone="success"
            icon={Timer}
            size="sm"
          />
        </div>

        <p className="num display-xl mt-3 text-ink">
          {formatDuration(workedMinutes)}
        </p>
        <p className="num mt-1 text-[13px] text-ink-muted">
          Vào ca lúc {formatTime(record.checkIn)}
          {shift ? ` · ${shift.name}` : ""}
        </p>

        <Button
          size="mobile"
          variant="destructive"
          className="mt-5"
          disabled={isPending}
          onClick={() => onCheckOut(clock)}
        >
          <LogOut aria-hidden="true" />
          {isPending ? "Đang ghi nhận…" : "Tan ca"}
        </Button>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          {record.location}
        </p>
      </section>
    );
  }

  /* ------------------------------------------------ Chua vao ca */
  const expectedStart = shift?.startTime ?? "08:00";
  const lateBy = now
    ? Math.max(
        minutesBetween(expectedStart, clock) > 720
          ? 0
          : minutesBetween(expectedStart, clock) -
              (shift?.lateToleranceMinutes ?? 0),
        0,
      )
    : 0;

  return (
    <section className="surface-card p-5 text-center">
      <StatusBadge
        kind="custom"
        label="Chưa vào ca"
        tone="neutral"
        icon={Timer}
        size="sm"
        className="mx-auto"
      />

      <p className="num display-xl mt-4 text-ink" aria-live="off">
        {clock}
        <span className="text-ink-muted">:{seconds}</span>
      </p>
      <p className="num mt-1 text-[13px] text-ink-muted">
        Giờ vào ca dự kiến {minutesToTime(
          Number(expectedStart.slice(0, 2)) * 60 + Number(expectedStart.slice(3)),
        )}
      </p>

      {lateBy > 0 ? (
        <p className="num mt-2 text-[13px] font-medium text-warning">
          Bạn đang muộn {formatDuration(lateBy)} so với giờ vào ca.
        </p>
      ) : null}

      <Button
        size="mobile"
        className="mt-5"
        disabled={isPending || !now}
        onClick={onCheckIn}
      >
        <LogIn aria-hidden="true" />
        {isPending ? "Đang ghi nhận…" : "Vào ca"}
      </Button>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs leading-relaxed text-ink-muted">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
        {canCheckInRemotely
          ? "Bạn được phép chấm công ngoài địa điểm làm việc."
          : "Vị trí GPS sẽ được ghi nhận để đối chiếu với địa điểm làm việc."}
      </p>
    </section>
  );
}

function TimeBlock({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}): React.ReactElement {
  return (
    <div
      className={
        emphasis
          ? "rounded-control border border-brand-subdued bg-brand-wash px-2.5 py-2.5"
          : "rounded-control border border-hairline bg-canvas-soft px-2.5 py-2.5"
      }
    >
      <p className="text-[11px] leading-tight text-ink-muted">{label}</p>
      <p className="num mt-1 text-[15px] leading-tight font-medium text-ink">
        {value}
      </p>
    </div>
  );
}
