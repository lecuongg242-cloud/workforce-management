"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CalendarX2 } from "lucide-react";

import { MonthStepper } from "@/components/common/date-range-picker";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { MonthSummary } from "@/components/employee-app/month-summary";
import { DayPayBreakdown } from "@/components/payroll/day-pay-breakdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import {
  OVERTIME_DISPLAY_LABEL,
  WEEKDAY_LABEL,
  WORK_DAY_TYPE_LABEL,
} from "@/lib/constants";
import {
  getMonthlySummary,
  listAttendance,
  listAttendanceClassification,
} from "@/lib/data/attendance";
import { getMyPayslip } from "@/lib/data/payslips";
import { listShifts } from "@/lib/data/shifts";
import {
  formatDate,
  formatDurationShort,
  formatTime,
  formatVnd,
  getWeekday,
} from "@/lib/format";
import {
  groupAttendanceByDay,
  shiftBreakInfoById,
  type AttendanceDay,
} from "@/lib/attendance/day";
import { displayAttendanceStatus } from "@/lib/attendance/display-status";
import type {
  AttendanceDayClassification,
  AttendanceStatus,
  PayrollDayLine,
  PayrollPunchPay,
} from "@/lib/types/domain";
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

export function HistoryView({
  month: initialMonth,
  today,
}: {
  month: string;
  /** "YYYY-MM-DD" theo dong ho MAY CHU — xem `display-status.ts`. */
  today: string;
}): React.ReactElement {
  const session = useAuthenticatedSession();
  const employeeId = session.user.employeeId;
  const [month, setMonth] = React.useState(initialMonth);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  const { data, isLoading, error, reload } = useDataQuery(
    async () => {
      const [records, summary, shifts, classifications, payslip] =
        await Promise.all([
          listAttendance({ companyId: session.companyId, employeeId, month }),
          getMonthlySummary(session.companyId, employeeId, month),
          listShifts(session.companyId),
          listAttendanceClassification(session.companyId, employeeId, month),
          /**
           * TIEN CUA TUNG NGAY, va no CO QUYEN THAT BAI.
           *
           * `can_view_payslip = false` tra 403 (`assertCanViewOwnPayslip`) —
           * mot doanh nghiep phat phieu giay la chuyen binh thuong, khong phai
           * loi. Ngay ca khi la loi that (mat mang), gio cong van la thu nguoi
           * dung vao day de xem. Vi vay loi o day nuot lai thanh `null` va man
           * hinh chi bo phan tien di, thay vi keo ca trang thanh mot o bao loi.
           *
           * Con so KHONG duoc tinh lai o day: day la dung nhung dong tien ma
           * man Phieu luong hien, nen hai man hinh khong the noi hai con so.
           */
          getMyPayslip(month).catch(() => null),
        ]);
      return { records, summary, shifts, classifications, payslip };
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

  /**
   * Mot ngay co the co NHIEU luot vao/ra (migration 0013) — gop truoc khi
   * hien thi, neu khong mot ngay se hien ra thanh hai ba the nhu the do la
   * nhung ngay khac nhau.
   */
  const days = React.useMemo(
    () =>
      data
        ? groupAttendanceByDay(data.records, shiftBreakInfoById(data.shifts))
        : [],
    [data],
  );

  /**
   * Phan loai cong theo NGAY (SET-04) — loai ngay va gio quy doi den tu
   * server, khong tinh lai o client: mot phep tinh thu hai o day se lech voi
   * tong hop thang ma khong ai biet ben nao dung.
   */
  const classificationByDate = React.useMemo(() => {
    const map = new Map<string, AttendanceDayClassification>();
    data?.classifications.forEach((item) => map.set(item.date, item));
    return map;
  }, [data]);

  /** Tien theo ngay; rong khi khong lay duoc phieu (xem chu thich o truy van). */
  const payByDate = React.useMemo(() => {
    const map = new Map<string, PayrollDayLine>();
    data?.payslip?.days.forEach((day) => map.set(day.date, day));
    return map;
  }, [data]);

  const visibleDays = React.useMemo(
    () => (selectedDate ? days.filter((day) => day.date === selectedDate) : days),
    [days, selectedDate],
  );

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
          {days.length > 0 ? (
            <section
              aria-label="Chọn ngày để lọc"
              className="no-scrollbar -mx-4 overflow-x-auto px-4"
            >
              <div className="flex gap-1.5">
                {[...days]
                  .sort((a, b) => (a.date < b.date ? -1 : 1))
                  .map((day) => {
                    const isSelected = selectedDate === day.date;
                    const weekday = getWeekday(day.date);
                    return (
                      <button
                        key={day.date}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          setSelectedDate(isSelected ? null : day.date)
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
                          {day.date.slice(8)}
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-1.5 rounded-full",
                            dotClass[day.status],
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

            {visibleDays.length === 0 ? (
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
                {visibleDays.map((day) => (
                  <AttendanceItem
                    key={day.date}
                    day={day}
                    shiftName={shiftNames[day.shiftId] ?? "—"}
                    classification={classificationByDate.get(day.date)}
                    pay={payByDate.get(day.date)}
                    today={today}
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
  day,
  shiftName,
  classification,
  pay,
  today,
}: {
  day: AttendanceDay;
  shiftName: string;
  classification: AttendanceDayClassification | undefined;
  /** `undefined` khi khong lay duoc phieu luong — khoi tien khong hien. */
  pay: PayrollDayLine | undefined;
  /** "YYYY-MM-DD" theo dong ho MAY CHU. */
  today: string;
}): React.ReactElement {
  const weekday = getWeekday(day.date);

  // Phan gio KHONG phai tang ca. Tru tu chinh `workedMinutes` cua ban phan loai
  // chu khong tu `day.workedMinutes`: hai so nay hom nay bang nhau (cung mot
  // phep gop), va lay ca hai tu MOT nguon la cach dam bao rang neu mai kia
  // chung khac nhau thi "Trong ca + Tang ca" van bang dung mot con so co that,
  // thay vi mot hieu so cua hai phep tinh khac nhau.
  const regularMinutes = classification
    ? Math.max(classification.workedMinutes - classification.overtimeMinutes, 0)
    : 0;

  // Tra theo CHI SO LUOT chu khong theo thu tu mang: `pay.punches` chi mang
  // nhung luot co gio, nen doc theo vi tri se gan tien cua luot nay cho luot
  // khac ngay khi mot luot bi bo qua.
  const payByPunchIndex = React.useMemo(() => {
    const map = new Map<number, PayrollPunchPay>();
    pay?.punches.forEach((item) => map.set(item.index, item));
    return map;
  }, [pay]);

  return (
    <li className="surface-card p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="num text-[15px] font-medium text-ink">
            {formatDate(day.date)}
          </p>
          <p className="text-[13px] text-ink-muted">
            {WEEKDAY_LABEL[weekday]} · {shiftName}
            {day.punches.length > 1 ? ` · ${day.punches.length} lượt` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge
            kind="attendance"
            value={displayAttendanceStatus({
              status: day.status,
              // `lastCheckOut` la `null` khi luot cuoi cua ngay chua tan ca —
              // dung dieu kien "chua cham ra" o muc CA NGAY.
              checkIn: day.firstCheckIn,
              checkOut: day.lastCheckOut,
              date: day.date,
              today,
            })}
            size="sm"
          />
          {/* Loai ngay hien bang NHAN CHU, khong phai mau — va chi hien khi
              KHAC ngay thuong, de dong ngay binh thuong khong bi them nhieu. */}
          {classification && classification.dayType !== "weekday" ? (
            <span className="text-[11px] text-ink-muted">
              {WORK_DAY_TYPE_LABEL[classification.dayType]}
            </span>
          ) : null}
        </div>
      </div>

      {/* Gio vao/ra la cua LUOT DAU va LUOT CUOI; tong gio cong don moi luot. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniCell label="Giờ vào" value={formatTime(day.firstCheckIn)} />
        <MiniCell label="Giờ ra" value={formatTime(day.lastCheckOut)} />
        <MiniCell
          label="Tổng giờ"
          value={
            day.workedMinutes > 0 ? formatDurationShort(day.workedMinutes) : "—"
          }
        />
      </div>

      {/* TACH DOI SO GIO cua o "Tong gio" ben tren: bao nhieu la gio trong ca,
          bao nhieu la tang ca. Khong hien gio QUY DOI — do la mot buoc trung
          gian giua so gio va so tien, va ca hai dau da co mat ngay tren man
          hinh nay.

          Phan "Trong ca" bi an khi bang 0 (ngay le / ngay nghi co toan bo gio
          la tang ca): mot o "Trong ca 0h00" khong noi them dieu gi ma dong chu
          da dai gap doi. */}
      {classification && classification.overtimeMinutes > 0 ? (
        <p className="mt-2 text-[12px] text-ink-muted">
          {regularMinutes > 0 ? (
            <>
              {OVERTIME_DISPLAY_LABEL.regularLabel}{" "}
              <span className="num text-ink">
                {formatDurationShort(regularMinutes)}
              </span>
              {" · "}
            </>
          ) : null}
          {OVERTIME_DISPLAY_LABEL.overtimeShortLabel}{" "}
          <span className="num text-ink">
            {formatDurationShort(classification.overtimeMinutes)}
          </span>
          {classification.overtimeNightMinutes > 0 ? (
            <>
              {" "}
              ({OVERTIME_DISPLAY_LABEL.nightPortionPrefix}{" "}
              <span className="num">
                {formatDurationShort(classification.overtimeNightMinutes)}
              </span>{" "}
              {OVERTIME_DISPLAY_LABEL.nightPortionSuffix})
            </>
          ) : null}
        </p>
      ) : null}

      {day.punches.length > 1 ? (
        <ul className="mt-2 grid gap-1.5">
          {day.punches.map((punch, index) => {
            const split = classification?.punches?.[index];
            const punchPay = payByPunchIndex.get(index);
            return (
              <li key={punch.id} className="px-0.5">
                {/* Luoi ba cot CO DINH — xem ghi chu cung van de o
                    `attendance-status-card.tsx`: cot co gian lam gio vao/gio
                    ra lech nhau giua cac dong. */}
                <div className="num grid grid-cols-[3rem_6.5rem_1fr] items-center gap-2 text-[12px] text-ink-muted">
                  <span>Lượt {index + 1}</span>
                  <span className="whitespace-nowrap">
                    {formatTime(punch.checkIn)} → {formatTime(punch.checkOut)}
                  </span>
                  <span className="text-right">
                    {punch.workedMinutes > 0
                      ? formatDurationShort(punch.workedMinutes)
                      : "—"}
                  </span>
                </div>

                {/* DONG THU HAI chi xuat hien khi luot nay CO tang ca — do la
                    luc con so cua no khac voi phan con lai cua ngay. Luot khong
                    tang ca da duoc dong tren noi het.

                    Tien co the vang mat (ky da chot khong luu theo luot) trong
                    khi so gio van con: khi ay hien phan gio, khong hien mot
                    dau gach ngang o cho tien — khong co con so nao bi thieu
                    ca, chi la ky do khong luu theo luot. */}
                {split && split.overtimeMinutes > 0 ? (
                  <div className="mt-0.5 flex items-baseline justify-between gap-2 pl-[3.5rem] text-[12px] text-ink-muted">
                    <span>
                      {split.regularMinutes > 0 ? (
                        <>
                          {OVERTIME_DISPLAY_LABEL.regularLabel}{" "}
                          <span className="num">
                            {formatDurationShort(split.regularMinutes)}
                          </span>
                          {" · "}
                        </>
                      ) : null}
                      {OVERTIME_DISPLAY_LABEL.overtimeShortLabel}{" "}
                      <span className="num">
                        {formatDurationShort(split.overtimeMinutes)}
                      </span>
                    </span>
                    {punchPay?.overtimePay != null ? (
                      <span className="num shrink-0 font-medium text-ink">
                        {formatVnd(punchPay.overtimePay)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Thoi luong tung luot la THO — khong noi ro thi "Tong gio" ben tren
          trong nhu cong sai. */}
      {day.breakMinutes > 0 ? (
        <p className="num mt-2 px-0.5 text-[12px] text-ink-muted">
          Đã trừ {formatDurationShort(day.breakMinutes)} giờ nghỉ của ca.
        </p>
      ) : null}

      {/* TIEN CUA NGAY — dat SAU phan gio vi no la ket luan cua nhung con so
          ben tren, va TRUOC o canh bao bo sung cham cong: mot o canh bao chen
          giua se cat doi mach "gio -> tien". */}
      {pay ? <DayPayBreakdown day={pay} className="mt-3" /> : null}

      {day.needsSupplement ? (
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
