"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CalendarX2 } from "lucide-react";

import {
  DayRangeFilter,
  MonthStepper,
  type DayRange,
} from "@/components/common/date-range-picker";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { MonthSummary } from "@/components/employee-app/month-summary";
import { DayPayBreakdown } from "@/components/payroll/day-pay-breakdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { useEmployeeSession } from "@/lib/auth/session-provider";
import {
  DAY_PAY_LABEL,
  OVERTIME_DISPLAY_LABEL,
  PAYSLIP_DAILY_LABEL,
  PAY_RATE_UNIT_SUFFIX,
  WEEKDAY_LABEL,
  WORK_DAY_TYPE_LABEL,
  describeMissingReason,
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
  formatDateTime,
  formatDurationShort,
  formatNumber,
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
  PayrollDayLine,
  PayrollPunchPay,
  PayslipDetail,
} from "@/lib/types/domain";
import { cn } from "@/lib/utils";

export function HistoryView({
  month: initialMonth,
  today,
}: {
  month: string;
  /** "YYYY-MM-DD" theo dong ho MAY CHU — xem `display-status.ts`. */
  today: string;
}): React.ReactElement {
  const { session, employeeId } = useEmployeeSession();
  const [month, setMonth] = React.useState(initialMonth);
  const [range, setRange] = React.useState<DayRange | null>(null);

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
    () =>
      range
        ? days.filter((day) => day.date >= range.from && day.date <= range.to)
        : days,
    [days, range],
  );

  // Doi thang thi bo loc ngay: mot khoang cua thang truoc se loc rong toan bo
  // thang moi, va man hinh se trong nhu the thang do khong co ngay cong nao.
  React.useEffect(() => {
    setRange(null);
  }, [month]);

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="display-md text-ink">Bảng lương</h1>
      </header>

      {/* MOT HANG DUY NHAT cho ca hai bo loc. Truoc day o day la mot dai ngay
          cuon ngang: no ngon tron mot khoi cao 64px de lam dung viec ma cai nut
          nay lam, va voi thang 31 ngay thi phan lon dai do nam ngoai man hinh. */}
      <div className="surface-card flex items-center justify-between gap-2 p-2 pl-1">
        <MonthStepper month={month} onChange={setMonth} maxMonth={initialMonth} />
        <DayRangeFilter month={month} value={range} onChange={setRange} />
      </div>

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : isLoading || !data ? (
        <>
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-36 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </>
      ) : (
        <>
          {/* TIEN TRUOC, CONG SAU — man hinh nay tra loi "thang nay toi duoc
              bao nhieu" truoc, roi moi den "vi sao lai la con so do". Nguoc
              lai se bat nguoi doc di qua ca bang cong truoc khi thay dieu ho
              mo man hinh nay de xem. */}
          {data.payslip ? <MonthPayCard payslip={data.payslip} /> : null}

          <MonthSummary summary={data.summary} title="Tổng hợp tháng" />

          <section>
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="heading-sm text-ink">
                {range ? "Ngày đã lọc" : "Theo ngày"}
              </h2>
              {range ? (
                <Button variant="ghost" size="sm" onClick={() => setRange(null)}>
                  Xem cả tháng
                </Button>
              ) : null}
            </div>

            {visibleDays.length === 0 ? (
              <div className="surface-card">
                <EmptyState
                  icon={CalendarX2}
                  title={
                    range
                      ? "Không có ngày công nào trong khoảng đã chọn"
                      : "Chưa có dữ liệu chấm công"
                  }
                  description={
                    range
                      ? "Thử mở rộng khoảng ngày, hoặc xem cả tháng."
                      : "Tháng này chưa ghi nhận ngày công nào."
                  }
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

/**
 * TIEN CUA CA THANG — phan tu man Phieu luong chuyen sang khi hai man hinh gop
 * lam mot.
 *
 * KHONG mang theo hai khoi "Chi tiet theo ngay" va "Cong cua ky" cua man cu:
 * o day chung da co mat duoi dang the tung ngay va o "Tong hop thang", va mot
 * ban sao thu hai cua cung con so chi tao co hoi cho hai cho noi khac nhau.
 *
 * MOI CON SO DEN TU SERVER. Man hinh khong cong lai, khong suy ra, khong lam
 * tron gi ngoai viec dinh dang — ke ca `netPay`, von co the tinh lai tu cac
 * thanh phan. Tinh lai o day la mo duong cho mot phieu tu mau thuan voi chinh
 * no khi mot thanh phan doi cach luu.
 */
function MonthPayCard({
  payslip,
}: {
  payslip: PayslipDetail;
}): React.ReactElement {
  return (
    <section className="surface-card overflow-hidden">
      {/* CAU TRA LOI, dat truoc moi thu khac va to hon moi thu khac.
          Nhan di TRUOC con so: mat cham vao chu nho truoc roi moi roi xuong
          con so lon — nguoc lai thi nguoi doc gap mot con so chua biet la cua
          cai gi. */}
      <div className="bg-canvas-soft px-4 py-5 text-center">
        <p className="eyebrow">Thực nhận</p>
        {/* `font-bold` de len SAU `display-lg`: thang chu hien thi cua he
            thong dat nen 300, va con so nay la ngoai le co chu dich — no la
            cau tra loi cua ca man hinh. */}
        <p className="num display-lg mt-1.5 font-bold text-brand">
          {payslip.netPay === null ? "—" : formatVnd(payslip.netPay)}
        </p>
        <p className="num mt-2 text-[12px] text-ink-muted">
          {payslip.closedAt === null
            ? PAYSLIP_DAILY_LABEL.notClosedYet
            : `Chốt ${formatDateTime(payslip.closedAt)}`}
        </p>
      </div>

      {/* Thieu du kien -> noi RO thieu gi. Mot dau gach ngang khong giai thich
          duoc se lam nguoi doc tuong he thong hong, trong khi that ra doanh
          nghiep chi chua khai mot con so.

          CHI ky DANG MO moi roi vao day duoc, va do la mot bat bien chu khong
          phai mot phep thu du: `closePayroll()` tu choi chot khi con dong thieu
          du kien, nen `ClosedPayslip` khong co truong `missing` nao ca. */}
      {payslip.status === "provisional" && payslip.missing.length > 0 ? (
        <div className="border-t border-hairline bg-warning-soft px-4 py-3">
          <p className="text-[12px] font-medium text-ink">Chưa tính được, vì:</p>
          <ul className="mt-1 grid gap-0.5 text-[12px] text-ink-secondary">
            {payslip.missing.map((reason) => (
              <li key={reason}>{describeMissingReason(reason)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="grid gap-2.5 border-t border-hairline p-4 text-[13px]">
        <MoneyRow
          label={
            payslip.payAmount === null || payslip.payUnit === null
              ? DAY_PAY_LABEL.basePay
              : `${DAY_PAY_LABEL.basePay} (${formatVnd(payslip.payAmount)}/${PAY_RATE_UNIT_SUFFIX[payslip.payUnit]})`
          }
          amount={payslip.basePay}
        />
        {payslip.overtimePay !== 0 ? (
          <MoneyRow label={DAY_PAY_LABEL.overtimePay} amount={payslip.overtimePay} />
        ) : null}
        {payslip.hourAdjustment !== 0 ? (
          <MoneyRow
            label={DAY_PAY_LABEL.hourAdjustment}
            amount={payslip.hourAdjustment}
          />
        ) : null}

        {payslip.allowanceItems.length > 0 ? (
          <>
            <Divider label="Phụ cấp" />
            {payslip.allowanceItems.map((item) => (
              <MoneyRow
                key={item.adjustmentId}
                label={
                  item.multiplier === 1
                    ? item.name
                    : `${item.name} × ${formatNumber(item.multiplier)}`
                }
                amount={item.amount}
              />
            ))}
          </>
        ) : null}

        {payslip.deductionItems.length > 0 ? (
          <>
            <Divider label="Khấu trừ" />
            {payslip.deductionItems.map((item) => (
              <MoneyRow
                key={item.adjustmentId}
                label={
                  item.multiplier === 1
                    ? item.name
                    : `${item.name} × ${formatNumber(item.multiplier)}`
                }
                // Khau tru luu la so DUONG o ban chot; dau tru la viec cua
                // hien thi, khong phai cua du lieu.
                amount={-item.amount}
              />
            ))}
          </>
        ) : null}

        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-hairline pt-2.5">
          <dt className="shrink-0 font-medium text-ink">Thực nhận</dt>
          <dd className="num text-right text-[17px] leading-none font-semibold text-brand">
            {payslip.netPay === null ? "—" : formatVnd(payslip.netPay)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function MoneyRow({
  label,
  amount,
}: {
  label: string;
  /** `null` = chua tinh duoc; hien gach ngang, TUYET DOI khong hien 0. */
  amount: number | null;
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="min-w-0 flex-1 text-ink-secondary">{label}</dt>
      <dd
        className={cn(
          "num shrink-0 text-right font-medium",
          amount !== null && amount < 0 ? "text-danger" : "text-ink",
        )}
      >
        {amount === null ? "—" : formatVnd(amount)}
      </dd>
    </div>
  );
}

function Divider({ label }: { label: string }): React.ReactElement {
  return (
    <p className="mt-1 border-t border-hairline pt-2.5 text-[12px] font-medium uppercase tracking-wide text-ink-muted">
      {label}
    </p>
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

      {/* Gio vao/ra la cua LUOT DAU va LUOT CUOI; tong gio cong don moi luot.

          "Tong gio" duoc danh dau `emphasis`: hai o dau la du kien tho, o thu
          ba la ket qua cua chung. Ba o giong het nhau thi mat phai doc het ca
          ba nhan moi biet o nao dang tra loi cau hoi cua minh. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniCell label="Giờ vào" value={formatTime(day.firstCheckIn)} />
        <MiniCell label="Giờ ra" value={formatTime(day.lastCheckOut)} />
        {/* Chi to noi khi CO so gio. Mot o duoc lam noi bat ma ben trong la
            dau gach ngang thi keo mat vao dung cho khong co gi de doc — ngay
            nghi phep va ngay dang do deu roi vao truong hop do. */}
        <MiniCell
          label="Tổng giờ"
          value={
            day.workedMinutes > 0 ? formatDurationShort(day.workedMinutes) : "—"
          }
          emphasis={day.workedMinutes > 0}
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
        <p className="mt-2 px-0.5 text-[12px] text-ink-muted">
          {regularMinutes > 0 ? (
            <>
              {OVERTIME_DISPLAY_LABEL.regularLabel}{" "}
              <span className="num font-semibold text-ink">
                {formatDurationShort(regularMinutes)}
              </span>
              <span className="px-1.5 text-hairline">|</span>
            </>
          ) : null}
          {OVERTIME_DISPLAY_LABEL.overtimeShortLabel}{" "}
          <span className="num font-semibold text-ink">
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
                  <span className="whitespace-nowrap text-ink-secondary">
                    {formatTime(punch.checkIn)} → {formatTime(punch.checkOut)}
                  </span>
                  <span className="text-right font-medium text-ink">
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
                    {/* Tien cua luot: MAU thuong hieu vi no la tien, nhung
                        van 12px — no la mot phan cua "Luong tang ca" o khoi
                        duoi, khong phai mot ket luan doc lap. */}
                    {punchPay?.overtimePay != null ? (
                      <span className="num shrink-0 font-medium text-brand">
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
  emphasis = false,
}: {
  label: string;
  value: string;
  /** O mang KET QUA, khong phai du kien — vien dam hon va so to hon. */
  emphasis?: boolean;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "rounded-control border px-2.5 py-2",
        emphasis
          ? "border-brand-subdued bg-brand-wash"
          : "border-hairline bg-canvas-soft",
      )}
    >
      <p
        className={cn(
          "text-[10px] leading-tight",
          emphasis ? "text-brand-deep" : "text-ink-muted",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "num mt-0.5 leading-tight font-medium text-ink",
          emphasis ? "text-[15px] font-semibold" : "text-[14px]",
        )}
      >
        {value}
      </p>
    </div>
  );
}
