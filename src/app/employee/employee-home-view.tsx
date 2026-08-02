"use client";

import * as React from "react";
import { toast } from "sonner";

import { isAttendanceRejection } from "@/lib/attendance/rejection";
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
   * Khong null nghia la Camera Sheet dang mo o CHE DO TAN CA cho ban ghi
   * nay (plan 03-04, Task 3) — null nghia la che do vao ca (mac dinh). Mot
   * Camera Sheet DUY NHAT phuc vu ca hai nut "Vào ca"/"Tan ca", phan biet
   * bang state nay thay vi dung hai Sheet rieng.
   */
  const [pendingCheckOutRecordId, setPendingCheckOutRecordId] = React.useState<
    string | null
  >(null);

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
   * "Vào ca" giờ CHỈ mở Camera Sheet ở chế độ vào ca (ATT-01) — không còn
   * gửi chấm công trực tiếp. Server Action thật sự chạy trong
   * `handlePunchSubmit`, nhận bằng chứng (ảnh + toạ độ) từ chính Camera
   * Sheet.
   */
  const handleOpenCamera = (): void => {
    setPendingCheckOutRecordId(null);
    setCameraOpen(true);
  };

  /**
   * "Tan ca" (plan 03-04, Task 3) mở CÙNG Camera Sheet nhưng ở chế độ tan
   * ca — ghi lại `recordId` cần tan ca TRƯỚC khi mở Sheet, vì `checkOut`
   * (khác `checkIn`) cần biết đang tan ca cho bản ghi nào. Giữ nguyên kiểm
   * tra "dữ liệu minh hoạ" đã có từ trước 03-04: không mở camera cho một
   * bản ghi demo không tồn tại thật.
   */
  const handleOpenCheckOut = (): void => {
    if (!displayRecord || displayRecord.id === "demo") {
      toast.info("Đây là dữ liệu minh họa, không thể tan ca.");
      return;
    }
    setPendingCheckOutRecordId(displayRecord.id);
    setCameraOpen(true);
  };

  /**
   * Đóng Sheet ở BẤT KỲ chế độ nào đều xoá `pendingCheckOutRecordId` — nếu
   * không, lần mở Camera Sheet TIẾP THEO (qua "Vào ca") sẽ vô tình kế thừa
   * chế độ tan ca của lần trước.
   */
  const handleCameraOpenChange = (nextOpen: boolean): void => {
    setCameraOpen(nextOpen);
    if (!nextOpen) setPendingCheckOutRecordId(null);
  };

  /**
   * KHÔNG bắt lỗi để hiện toast riêng ở đây — để lỗi lan ngược lên
   * `CameraSheet.handleSubmit`, nơi giữ lại ảnh + toạ độ đã chụp trong bộ
   * nhớ và cho người dùng gửi lại mà không phải chụp lại (D-23), thay vì
   * hiện một toast trùng lặp ở đây rồi lại một khối banner khác ở Camera
   * Sheet cho CÙNG một sự kiện. `isAttendanceRejection(cause)` chỉ dùng để
   * LOG (không toast, không chặn lan lỗi) khi lỗi KHÔNG PHẢI một lần từ
   * chối đã biết — một tín hiệu debug rẻ cho lỗi hạ tầng thật sự (DB lỗi,
   * mất kết nối RPC) mà không đụng tới đường hiển thị đã chứng minh của
   * Camera Sheet.
   *
   * Dùng CHUNG cho cả vào ca lẫn tan ca — `pendingCheckOutRecordId` (state)
   * quyết định gọi `checkInService` hay `checkOutService`, cùng một
   * `PunchSubmitResult` trả về cho Camera Sheet quyết định có hiện banner
   * "đã ghi nhận nhưng ở xa" (D-20) hay không bằng dữ liệu THẬT server vừa
   * tính — không đoán ở client.
   */
  const handlePunchSubmit = async (
    evidence: PunchEvidence,
  ): Promise<PunchSubmitResult> => {
    setIsPending(true);
    try {
      const result = pendingCheckOutRecordId
        ? await checkOutService(pendingCheckOutRecordId, evidence)
        : await checkInService(employeeId, evidence);
      setDemoState(null);
      invalidate();
      if (!result.isOutsideRadius) {
        if (pendingCheckOutRecordId) {
          toast.success(
            result.checkOut
              ? `Đã ghi nhận giờ tan ca lúc ${result.checkOut}.`
              : "Đã ghi nhận giờ tan ca.",
          );
        } else {
          toast.success(
            result.checkIn
              ? `Đã ghi nhận giờ vào ca lúc ${result.checkIn}.`
              : "Đã ghi nhận giờ vào ca.",
          );
        }
      }
      return {
        distanceMeters: result.distanceMeters,
        workSiteName: result.workSiteName,
        isOutsideRadius: result.isOutsideRadius,
      };
    } catch (cause) {
      if (!isAttendanceRejection(cause)) {
        console.error("Punch submit error (non-rejection):", cause);
      }
      throw cause;
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
            onCheckOut={handleOpenCheckOut}
            canCheckInRemotely={data.employee?.canCheckInRemotely ?? false}
          />

          <MonthSummary summary={data.summary} />

          <QuickActions />

          <DemoStateSwitcher value={demoState} onChange={setDemoState} />
        </>
      )}

      <CameraSheet
        open={cameraOpen}
        onOpenChange={handleCameraOpenChange}
        onSubmit={handlePunchSubmit}
        punchKind={pendingCheckOutRecordId ? "check_out" : "check_in"}
      />
    </div>
  );
}
