"use client";

import * as React from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/error-state";
import { AttendanceStatusCard } from "@/components/employee-app/attendance-status-card";
import { CurrentShiftCard } from "@/components/employee-app/current-shift-card";
import { MonthSummary } from "@/components/employee-app/month-summary";
import { QuickActions } from "@/components/employee-app/quick-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentGreeting } from "@/hooks/use-current-greeting";
import { useMockQuery } from "@/hooks/use-mock-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import {
  checkIn as checkInService,
  checkOut as checkOutService,
  getMonthlySummary,
  listAttendance,
} from "@/lib/data/attendance";
import { getEmployee } from "@/lib/data/employees";
import { listShifts } from "@/lib/data/shifts";
import { formatFullDate, getShortName } from "@/lib/format";
import { useMockData } from "@/lib/mock/store";
import type { AttendanceRecord, CheckInState } from "@/lib/types/domain";
import { DemoStateSwitcher } from "@/components/employee-app/demo-state-switcher";

export function EmployeeHomeView({
  today,
  month,
}: {
  today: string;
  month: string;
}): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useMockData();
  const employeeId = session.user.employeeId;
  const [isPending, setIsPending] = React.useState(false);

  /**
   * Trang thai demo do nguoi dung chon o thanh cuoi trang.
   * `null` nghia la lay theo du lieu that trong kho mock.
   */
  const [demoState, setDemoState] = React.useState<CheckInState | null>(null);

  const { data, isLoading, error, reload } = useMockQuery(
    async () => {
      const [employee, shifts, todayRecords, summary] = await Promise.all([
        getEmployee(employeeId),
        listShifts(session.companyId),
        listAttendance({
          companyId: session.companyId,
          employeeId,
          date: today,
        }),
        getMonthlySummary(session.companyId, employeeId, month),
      ]);
      return { employee, shifts, todayRecord: todayRecords[0] ?? null, summary };
    },
    [employeeId, session.companyId, today, month],
  );

  const greeting = useCurrentGreeting();

  const shift =
    data?.shifts.find((item) => item.id === data.employee?.shiftId) ?? null;

  /** Trang thai thuc te suy ra tu ban ghi cham cong hom nay */
  const realState: CheckInState = !data?.todayRecord?.checkIn
    ? "not_started"
    : data.todayRecord.checkOut
      ? "finished"
      : "working";

  const state = demoState ?? realState;

  /** Ban ghi hien thi — khi demo can du lieu gia lap thi dung ban mau */
  const displayRecord: AttendanceRecord | null = React.useMemo(() => {
    if (!demoState || !data) return data?.todayRecord ?? null;
    if (demoState === "not_started") return null;

    const base: AttendanceRecord = data.todayRecord ?? {
      id: "demo",
      companyId: session.companyId,
      employeeId,
      date: today,
      shiftId: shift?.id ?? "",
      checkIn: "07:52",
      checkOut: null,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      status: "on_time",
      location: data.employee?.workLocation ?? "Văn phòng chính",
      needsSupplement: false,
      note: null,
    };

    if (demoState === "working") {
      return { ...base, checkIn: base.checkIn ?? "07:52", checkOut: null };
    }
    return {
      ...base,
      checkIn: base.checkIn ?? "07:52",
      checkOut: base.checkOut ?? "17:34",
      workedMinutes: base.workedMinutes > 0 ? base.workedMinutes : 492,
      status: base.checkOut ? base.status : "on_time",
    };
  }, [demoState, data, session.companyId, employeeId, shift, today]);

  const handleCheckIn = async (time: string): Promise<void> => {
    setIsPending(true);
    try {
      await checkInService(session.companyId, employeeId, today, time);
      setDemoState(null);
      invalidate();
      toast.success(`Đã ghi nhận giờ vào ca lúc ${time}.`);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không ghi nhận được giờ vào.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleCheckOut = async (time: string): Promise<void> => {
    if (!displayRecord || displayRecord.id === "demo") {
      toast.info("Đây là dữ liệu minh họa, không thể tan ca.");
      return;
    }
    setIsPending(true);
    try {
      await checkOutService(displayRecord.id, time);
      setDemoState(null);
      invalidate();
      toast.success(`Đã ghi nhận giờ tan ca lúc ${time}.`);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không ghi nhận được giờ ra.",
      );
    } finally {
      setIsPending(false);
    }
  };

  if (error) {
    return <ErrorState description={error} onRetry={reload} />;
  }

  return (
    <div className="grid gap-4">
      {/* Loi chao */}
      <header>
        <h1 className="display-md text-ink">
          {greeting}, {getShortName(data?.employee?.fullName ?? session.user.fullName)}
        </h1>
        <p className="num mt-1 text-[13px] text-ink-muted">
          Hôm nay, {formatFullDate(today)}
        </p>
      </header>

      {isLoading || !data ? (
        <>
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
        </>
      ) : (
        <>
          <CurrentShiftCard
            shift={shift}
            workLocation={data.employee?.workLocation ?? "Văn phòng chính"}
          />

          <AttendanceStatusCard
            state={state}
            record={displayRecord}
            shift={shift}
            isPending={isPending}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            canCheckInRemotely={data.employee?.canCheckInRemotely ?? false}
          />

          <MonthSummary summary={data.summary} />

          <QuickActions />

          <DemoStateSwitcher value={demoState} onChange={setDemoState} />
        </>
      )}
    </div>
  );
}
