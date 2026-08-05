"use client";

import * as React from "react";
import { toast } from "sonner";

import { getAttendanceDay, shiftBreakInfoById } from "@/lib/attendance/day";
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
import type { CheckInState, PunchEvidence } from "@/lib/types/domain";

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
      return { employee, shifts, todayRecords, summary };
    },
    [employeeId, session.companyId, today, month],
  );

  const greeting = useCurrentGreeting();

  const shift =
    data?.shifts.find((item) => item.id === data.employee?.shiftId) ?? null;

  /**
   * Mot ngay co the co NHIEU luot vao/ra (migration 0013) — gop lai truoc khi
   * hien thi thay vi lay ban ghi dau tien nhu truoc.
   */
  const todayDay = data
    ? getAttendanceDay(
        data.todayRecords,
        today,
        shiftBreakInfoById(data.shifts),
      )
    : null;
  const openPunch =
    todayDay?.punches.find((punch) => punch.checkOut === null) ?? null;

  /** Trang thai thuc te suy ra tu cac luot cham cong hom nay */
  const realState: CheckInState = !todayDay || todayDay.punches.length === 0
    ? "not_started"
    : openPunch
      ? "working"
      : "finished";

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
   * (khác `checkIn`) cần biết đang tan ca cho bản ghi nào.
   */
  const handleOpenCheckOut = (): void => {
    // Tan ca cho dung LUOT DANG MO, khong phai "ban ghi cua hom nay" — mot
    // ngay co the co nhieu luot da khep lai truoc do.
    if (!openPunch) return;
    setPendingCheckOutRecordId(openPunch.id);
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
   * Sheet cho CÙNG một sự kiện.
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
      // KHONG console.error o day. Loi nem tu Server Action da duoc Camera
      // Sheet xu ly thanh mot banner doc duoc; goi console.error them mot lan
      // nua chi lam Next.js bat overlay loi cua che do dev de len ca man hinh
      // — nguoi dung thay "web dung" cho mot tinh huong da duoc xu ly tu te.
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
            state={realState}
            day={todayDay}
            shift={shift}
            isPending={isPending}
            onCheckIn={handleOpenCamera}
            onCheckOut={handleOpenCheckOut}
            canCheckInRemotely={data.employee?.canCheckInRemotely ?? false}
          />

          <MonthSummary summary={data.summary} />

          <QuickActions />
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
