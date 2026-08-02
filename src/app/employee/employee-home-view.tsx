"use client";

import * as React from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/error-state";
import { AttendanceStatusCard } from "@/components/employee-app/attendance-status-card";
import { CameraSheet } from "@/components/employee-app/camera-sheet";
import type { PunchSubmitResult } from "@/components/employee-app/camera-sheet";
import { CurrentShiftCard } from "@/components/employee-app/current-shift-card";
import { MonthSummary } from "@/components/employee-app/month-summary";
import { QuickActions } from "@/components/employee-app/quick-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentGreeting } from "@/hooks/use-current-greeting";
import { useDataQuery } from "@/hooks/use-data-query";
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
import { useDataStore } from "@/lib/data/store";
import type { AttendanceRecord, CheckInState, PunchEvidence } from "@/lib/types/domain";
import { DemoStateSwitcher } from "@/components/employee-app/demo-state-switcher";

export function EmployeeHomeView({
  today,
  month,
}: {
  today: string;
  month: string;
}): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();
  const employeeId = session.user.employeeId;
  const [isPending, setIsPending] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);

  /**
   * Trang thai demo do nguoi dung chon o thanh cuoi trang.
   * `null` nghia la lay theo du lieu that trong kho mock.
   */
  const [demoState, setDemoState] = React.useState<CheckInState | null>(null);

  const { data, isLoading, error, reload } = useDataQuery(
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

  /**
   * "Vào ca" giờ CHỈ mở Camera Sheet (ATT-01) — không còn gửi chấm công
   * trực tiếp. Server Action thật sự chạy trong `handlePunchSubmit`, nhận
   * bằng chứng (ảnh + toạ độ) từ chính Camera Sheet.
   */
  const handleOpenCamera = (): void => {
    setCameraOpen(true);
  };

  /**
   * KHÔNG bắt lỗi ở đây — để lỗi lan ngược lên `CameraSheet.handleSubmit`,
   * nơi giữ lại ảnh + toạ độ đã chụp trong bộ nhớ và cho người dùng gửi lại
   * mà không phải chụp lại (D-23), thay vì hiện một toast trùng lặp ở đây
   * rồi lại một toast khác ở Camera Sheet.
   *
   * `checkIn(employeeId, evidence)` — chữ ký cuối cùng sau ATT-06 (plan
   * 03-04): không còn tham số ngày/giờ nào để bỏ qua nữa.
   */
  /**
   * Tra ve `PunchSubmitResult` (plan 03-03, Task 3) de Camera Sheet tu
   * quyet co hien banner "da ghi nhan nhung o xa" (D-20) hay khong bang du
   * lieu THAT server vua tinh — khong doan o client. Khi bi danh dau
   * (`isOutsideRadius`), KHONG toast o day: Camera Sheet se hien banner cham
   * "Da hieu" thay the, tranh hai thong bao chong nhau cho cung mot su
   * kien.
   */
  const handlePunchSubmit = async (
    evidence: PunchEvidence,
  ): Promise<PunchSubmitResult> => {
    setIsPending(true);
    try {
      const result = await checkInService(employeeId, evidence);
      setDemoState(null);
      invalidate();
      if (!result.isOutsideRadius) {
        toast.success(
          result.checkIn
            ? `Đã ghi nhận giờ vào ca lúc ${result.checkIn}.`
            : "Đã ghi nhận giờ vào ca.",
        );
      }
      return {
        distanceMeters: result.distanceMeters,
        workSiteName: result.workSiteName,
        isOutsideRadius: result.isOutsideRadius,
      };
    } finally {
      setIsPending(false);
    }
  };

  /**
   * `checkOut(recordId, evidence)` — plan 03-04, Task 2 đã xoá tham số
   * `time` khỏi chữ ký. `handleCheckOut(time: string)` giữ nguyên tham số
   * đầu vào (vẫn nhận `clock` từ `attendance-status-card.tsx`) và bản thân
   * KHÔNG dùng nó cho đường ghi (không còn chỗ nào để dùng) — Task 3 (cùng
   * plan) mới nối "Tan ca" đi qua Camera Sheet thật, đường ghi thật chờ Task
   * đó. `evidence` optional Ở MỨC KIỂU (như `checkIn` ở 03-01) để lời gọi
   * này compile được ngay sau Task 2 mà không phải sửa file này lần nữa;
   * thiếu evidence khiến `checkOut` ném `missing_photo` ngay lập tức.
   */
  const handleCheckOut = async (time: string): Promise<void> => {
    if (!displayRecord || displayRecord.id === "demo") {
      toast.info("Đây là dữ liệu minh họa, không thể tan ca.");
      return;
    }
    void time;
    setIsPending(true);
    try {
      await checkOutService(displayRecord.id);
      setDemoState(null);
      invalidate();
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
            onCheckIn={handleOpenCamera}
            onCheckOut={handleCheckOut}
            canCheckInRemotely={data.employee?.canCheckInRemotely ?? false}
          />

          <MonthSummary summary={data.summary} />

          <QuickActions />

          <DemoStateSwitcher value={demoState} onChange={setDemoState} />
        </>
      )}

      <CameraSheet
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onSubmit={handlePunchSubmit}
      />
    </div>
  );
}
