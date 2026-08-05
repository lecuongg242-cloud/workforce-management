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
import type { AttendanceDay } from "@/lib/attendance/day";
import type { CheckInState, Shift } from "@/lib/types/domain";

/**
 * The cham cong voi ba trang thai: chua vao ca, dang lam viec, da tan ca.
 *
 * Nhan mot `AttendanceDay` (da gop cac LUOT cua ngay) chu khong phai mot ban
 * ghi don le: tu migration 0013 mot ngay co the co nhieu luot vao/ra, va the
 * nay phai cho thay ca ngay chu khong chi luot cuoi.
 *
 * Dong ho chi bat dau chay sau khi component gan vao DOM de markup cua may chu
 * va trinh duyet khong lech nhau (tranh loi hydration).
 */
export function AttendanceStatusCard({
  state,
  day,
  shift,
  isPending,
  onCheckIn,
  onCheckOut,
  canCheckInRemotely,
}: {
  state: CheckInState;
  day: AttendanceDay | null;
  shift: Shift | null;
  isPending: boolean;
  /**
   * Khong con nhan tham so `time`: bam "Vào ca"/"Tan ca" deu CHI MO Camera
   * Sheet (plan 03-01 cho vao ca, 03-04 Task 3 cho tan ca) — dau thoi gian
   * that su do server cap TRONG luc gui bang chung, khong phai do dong ho
   * client tai thoi diem bam nut.
   */
  onCheckIn: () => void;
  onCheckOut: () => void;
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

  /* ------------------------------------------------ Da tan ca */
  if (state === "finished" && day) {
    const badge =
      day.status === "late"
        ? ("late" as const)
        : day.status === "early_leave"
          ? ("early_leave" as const)
          : ("on_time" as const);

    return (
      <section className="surface-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="heading-sm text-ink">Đã tan ca</h2>
          <StatusBadge kind="attendance" value={badge} size="sm" />
        </div>

        {day.punches.length > 1 ? (
          <PunchList day={day} />
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <TimeBlock label="Giờ vào" value={formatTime(day.firstCheckIn)} />
            <TimeBlock label="Giờ ra" value={formatTime(day.lastCheckOut)} />
            <TimeBlock
              label="Tổng thời gian"
              value={formatDuration(day.workedMinutes)}
              emphasis
            />
          </div>
        )}

        {day.punches.length === 1 && day.breakMinutes > 0 ? (
          <p className="num mt-2 text-[13px] text-ink-muted">
            Đã trừ {formatDuration(day.breakMinutes)} giờ nghỉ của ca.
          </p>
        ) : null}

        {/* Mot ngay co the co nhieu luot (0013): tan ca xong van vao lai duoc,
            vi du sau khi ra ngoai xu ly cong viec giua ca. */}
        <Button
          size="mobile"
          className="mt-5"
          disabled={isPending}
          onClick={onCheckIn}
        >
          <LogIn aria-hidden="true" />
          {isPending ? "Đang ghi nhận…" : "Chấm công vào lại"}
        </Button>

        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-muted">
          <MapPin aria-hidden="true" className="size-3.5" />
          {day.location}
        </p>
      </section>
    );
  }

  /* ------------------------------------------------ Dang lam viec */
  const openPunch = day?.punches.find((punch) => punch.checkOut === null) ?? null;

  if (state === "working" && openPunch?.checkIn) {
    // Neu dong ho hien tai som hon gio vao ca (nguoi dung xem thu vao ban dem),
    // minutesBetween se vong qua ngay — khi do coi nhu vua bat dau ca.
    const elapsed = now ? minutesBetween(openPunch.checkIn, clock) : 0;
    const currentMinutes = elapsed > 16 * 60 ? 0 : elapsed;
    // So phut cac luot DA khep lai truoc do trong ngay — `day.workedMinutes`
    // chi cong cac luot da tan ca, luot dang mo con bang 0 trong database.
    const earlierMinutes = day?.workedMinutes ?? 0;

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
          {formatDuration(currentMinutes)}
        </p>
        <p className="num mt-1 text-[13px] text-ink-muted">
          Vào ca lúc {formatTime(openPunch.checkIn)}
          {shift ? ` · ${shift.name}` : ""}
        </p>

        {earlierMinutes > 0 ? (
          <p className="num mt-1 text-[13px] text-ink-muted">
            Đã làm {formatDuration(earlierMinutes)} ở{" "}
            {day ? day.punches.length - 1 : 0} lượt trước đó · tổng{" "}
            <span className="font-medium text-ink">
              {formatDuration(earlierMinutes + currentMinutes)}
            </span>
          </p>
        ) : null}

        <Button
          size="mobile"
          variant="destructive"
          className="mt-5"
          disabled={isPending}
          onClick={onCheckOut}
        >
          <LogOut aria-hidden="true" />
          {isPending ? "Đang ghi nhận…" : "Tan ca"}
        </Button>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          {openPunch.location}
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

/** Danh sach luot — chi hien khi ngay co TU HAI luot tro len. */
function PunchList({ day }: { day: AttendanceDay }): React.ReactElement {
  return (
    <div className="mt-4">
      <ul className="grid gap-1.5">
        {day.punches.map((punch, index) => (
          /* Luoi ba cot CO DINH thay vi flex-1 + text-center: chieu rong cot
             thoi luong thay doi theo noi dung ("2 phút" so voi "7 giờ 22
             phút"), nen mot cot giua co gian se keo gio vao/gio ra lech nhau
             giua cac dong. */
          <li
            key={punch.id}
            className="grid grid-cols-[3.5rem_7rem_1fr] items-center gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2"
          >
            <span className="text-[13px] text-ink-muted">Lượt {index + 1}</span>
            <span className="num text-[13px] whitespace-nowrap text-ink">
              {formatTime(punch.checkIn)} → {formatTime(punch.checkOut)}
            </span>
            <span className="num text-right text-[13px] font-medium text-ink">
              {formatDuration(punch.workedMinutes)}
            </span>
          </li>
        ))}
      </ul>

      {/* Cac luot la thoi luong THO — khong co dong nay thi tong ben duoi
          trong nhu tinh sai. */}
      {day.breakMinutes > 0 ? (
        <div className="mt-1.5 flex items-center justify-between gap-3 px-3 text-[13px] text-ink-muted">
          <span>Trừ giờ nghỉ</span>
          <span className="num">−{formatDuration(day.breakMinutes)}</span>
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-3 rounded-control border border-brand-subdued bg-brand-wash px-3 py-2.5">
        <span className="text-[13px] text-ink-secondary">Tổng hôm nay</span>
        <span className="num text-[15px] font-medium text-ink">
          {formatDuration(day.workedMinutes)}
        </span>
      </div>
    </div>
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
