"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Clock,
  ImageIcon,
  KeyRound,
  Loader2,
  Mail,
  MailPlus,
  MoreHorizontal,
  Network,
  Pencil,
  UserMinus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AttendancePhotoDialog } from "@/components/attendance/attendance-photo-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeForm } from "@/components/employees/employee-form";
import { OvertimeRatePanel } from "@/components/employees/overtime-rate-panel";
import { PayRatePanel } from "@/components/employees/pay-rate-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import {
  ACCOUNT_LABELS,
  CONTRACT_TYPE_LABEL,
  GENDER_LABEL,
  NOT_DECLARED,
  REQUEST_TYPE_LABEL,
  SHIFT_REALIGN_LABEL,
  SYSTEM_ROLE_LABEL,
  WEEKDAY_LABEL,
} from "@/lib/constants";
import {
  formatDate,
  formatDuration,
  formatDurationShort,
  formatMonthLabel,
  formatTime,
} from "@/lib/format";
import {
  formatShiftSchedule,
  isHoursBasedShift,
  shiftScheduledMinutes,
} from "@/lib/shifts/schedule";
import { getMonthlySummary, listAttendance } from "@/lib/data/attendance";
import { listAttendancePhotos } from "@/lib/data/attendance-photos";
import { listDepartments } from "@/lib/data/departments";
import { getEmployee, listAllEmployees, updateEmployee } from "@/lib/data/employees";
import { displayAttendanceStatus } from "@/lib/attendance/display-status";
import { createEmployeeAccount } from "@/lib/data/mutations/accounts";
import {
  applyShiftRealign,
  previewShiftRealign,
  type ShiftRealignPreview,
} from "@/lib/data/mutations/shift-realign";
import type { Employee } from "@/lib/types/domain";
import { listRequests } from "@/lib/data/requests";
import { listShifts } from "@/lib/data/shifts";
import { useDataStore } from "@/lib/data/store";

export function EmployeeDetailView({
  employeeId,
  month,
  today,
}: {
  employeeId: string;
  month: string;
  today: string;
}): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();
  const [isEditing, setIsEditing] = React.useState(false);
  const [confirmTerminate, setConfirmTerminate] = React.useState(false);
  /** `null` = khong co gi de hoi. Khac rong: hop thoai chi mo khi co ngay that. */
  const [realignPreview, setRealignPreview] =
    React.useState<ShiftRealignPreview | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = React.useState(false);
  const [newAccount, setNewAccount] = React.useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [photoRecordId, setPhotoRecordId] = React.useState<string | null>(null);

  const { data, isLoading, error, reload } = useDataQuery(
    async () => {
      const employee = await getEmployee(employeeId);
      if (!employee) return null;

      const [departments, shifts, allEmployees, attendance, requests, summary] =
        await Promise.all([
          listDepartments(session.companyId),
          listShifts(session.companyId),
          listAllEmployees(session.companyId),
          listAttendance({ companyId: session.companyId, employeeId }),
          listRequests({ companyId: session.companyId, employeeId }),
          getMonthlySummary(session.companyId, employeeId, month),
        ]);

      // Dau hieu nho "ban ghi co anh hay khong" cho bang lich su (03-05 Task
      // 2b) — chi owner/admin xem duoc sieu du lieu anh (ATT-04); goi truoc
      // se nem 403 va lam vo ca trang, nen chi thu khi dung vai tro. Gioi
      // han o 20 dong dang hien thi (cung so voi `attendance.slice(0, 20)`
      // ben duoi) — chap nhan duoc o quy mo 1-2 doanh nghiep cua du an,
      // khong dung mot route gom nhieu ban ghi vi plan nay chua dinh nghia
      // duong do (tranh mo rong pham vi thanh mot API moi).
      const photoPresence = new Map<string, boolean>();
      const canSeePhotos = session.role === "owner" || session.role === "admin";
      if (canSeePhotos) {
        try {
          const entries = await Promise.all(
            attendance.slice(0, 20).map(async (record) => {
              const photos = await listAttendancePhotos(record.id);
              return [record.id, photos.length > 0] as const;
            }),
          );
          for (const [id, hasPhoto] of entries) {
            photoPresence.set(id, hasPhoto);
          }
        } catch {
          // Khong lam vo ca trang chi vi khong lay duoc dau hieu phu.
        }
      }

      return {
        employee,
        departments,
        shifts,
        allEmployees,
        attendance,
        requests,
        summary,
        photoPresence,
      };
    },
    [employeeId, session.companyId, session.role, month],
  );

  const handleCreateAccount = async (): Promise<void> => {
    setIsCreatingAccount(true);
    try {
      const result = await createEmployeeAccount(employeeId);
      setNewAccount(result);
      invalidate();
      toast.success(ACCOUNT_LABELS.createSuccessToast);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : ACCOUNT_LABELS.genericError);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  /**
   * Sau khi luu ho so: neu ca MOI la ca linh hoat va con ngay cham cong cua ky
   * CHUA CHOT dang gan ca cu, hoi nguoi dung co ap ca moi cho nhung ngay do
   * khong.
   *
   * CHI hoi o chieu sang ca linh hoat. Chieu nguoc lai khong hoi va khong lam
   * gi: tinh lai theo chieu do se bien nguoi ta thanh di muon HOI TO cho nhung
   * ngay ma luc do ho khong he co gio moc nao de muon.
   */
  const offerRealign = async (updated: Employee): Promise<void> => {
    const nextShift = shifts.find((item) => item.id === updated.shiftId);
    if (nextShift?.kind !== "hours") return;

    try {
      const preview = await previewShiftRealign(employeeId);
      if (preview.dayCount > 0) setRealignPreview(preview);
    } catch {
      // Khong hoi duoc thi thoi — day la mot loi moi, khong phai mot loi. Luu
      // ho so DA thanh cong roi, va bao loi o day se lam nguoi dung tuong viec
      // vua lam bi hong.
    }
  };

  const handleRealign = async (): Promise<void> => {
    setIsPending(true);
    try {
      const result = await applyShiftRealign(employeeId);
      invalidate();
      toast.success(
        `${SHIFT_REALIGN_LABEL.successPrefix} ${result.dayCount} ${SHIFT_REALIGN_LABEL.successSuffix}`,
      );
      setRealignPreview(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : SHIFT_REALIGN_LABEL.errorFallback,
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleTerminate = async (): Promise<void> => {
    setIsPending(true);
    try {
      await updateEmployee(employeeId, { status: "terminated" });
      invalidate();
      toast.success("Đã cập nhật trạng thái nhân viên.");
      setConfirmTerminate(false);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không cập nhật được trạng thái.",
      );
    } finally {
      setIsPending(false);
    }
  };

  if (error) {
    return (
      <div className="surface-card">
        <ErrorState description={error} onRetry={reload} />
      </div>
    );
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!data) {
    return (
      <div className="surface-card">
        <EmptyState
          title="Không tìm thấy nhân viên"
          description="Nhân viên này có thể đã bị xóa hoặc đường dẫn không đúng."
          action={
            <Button asChild>
              <Link href="/admin/employees">Về danh sách nhân viên</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const {
    employee,
    departments,
    shifts,
    allEmployees,
    attendance,
    requests,
    summary,
    photoPresence,
  } = data;
  const department = departments.find((item) => item.id === employee.departmentId);
  const shift = shifts.find((item) => item.id === employee.shiftId);
  // Tra ten ca cho TUNG BAN GHI. Khong dung `shift` o tren — do la ca HIEN TAI
  // cua nhan vien, con moi ban ghi mang ca cua chinh ngay do.
  const shiftNameById = new Map(shifts.map((item) => [item.id, item.name]));
  const manager = allEmployees.find((item) => item.id === employee.managerId);
  const isAdminRole = session.role === "owner" || session.role === "admin";
  const canCreateAccount = isAdminRole && !employee.hasAccount;

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-3">
          <Link href="/admin/employees">
            <ArrowLeft aria-hidden="true" />
            Quay lại danh sách
          </Link>
        </Button>

        {/* Phan dau ho so */}
        <div className="surface-card flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <EmployeeAvatar
              name={employee.fullName}
              avatarUrl={employee.avatarUrl}
              size="xl"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="display-md text-ink">{employee.fullName}</h1>
                <StatusBadge kind="employee" value={employee.status} />
              </div>
              <p className="num mt-1 text-sm text-ink-muted">{employee.code}</p>
              <p className="mt-1 text-sm text-ink-secondary">
                {employee.position} · {department?.name ?? "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button onClick={() => setIsEditing(true)}>
              <Pencil aria-hidden="true" />
              Chỉnh sửa
            </Button>
            {canCreateAccount ? (
              <Button
                variant="outline"
                onClick={handleCreateAccount}
                disabled={isCreatingAccount}
              >
                {isCreatingAccount ? (
                  <>
                    <Loader2 aria-hidden="true" className="animate-spin" />
                    {ACCOUNT_LABELS.createButtonPending}
                  </>
                ) : (
                  <>
                    <KeyRound aria-hidden="true" />
                    {ACCOUNT_LABELS.createButtonIdle}
                  </>
                )}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Hành động khác"
                className="inline-flex size-10 items-center justify-center rounded-full border border-hairline text-ink-secondary transition-colors hover:bg-canvas-soft"
              >
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setIsEditing(true)}>
                  <Network aria-hidden="true" />
                  Chuyển phòng ban
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    toast.success(`Đã gửi lại lời mời tới ${employee.email}.`)
                  }
                >
                  <MailPlus aria-hidden="true" />
                  Gửi lại lời mời
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={employee.status === "terminated"}
                  onSelect={() => setConfirmTerminate(true)}
                >
                  <UserMinus aria-hidden="true" />
                  Đánh dấu đã nghỉ việc
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="attendance">Chấm công</TabsTrigger>
          <TabsTrigger value="schedule">Lịch làm việc</TabsTrigger>
          <TabsTrigger value="requests">Yêu cầu</TabsTrigger>
          <TabsTrigger value="salary">Thông tin lương</TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------- Tong quan */}
        <TabsContent value="overview" className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="grid gap-4 xl:col-span-2">
            <InfoCard title="Thông tin liên hệ" icon={Mail}>
              <InfoRow label="Email" value={employee.email} />
              {/* Sau truong khong bat buoc (0028) hien "—" khi chua khai — KHONG
                  hien mot gia tri dai dien, thu ma nguoi doc se tuong la that. */}
              <InfoRow
                label="Số điện thoại"
                value={employee.phone ?? NOT_DECLARED}
                numeric
              />
              <InfoRow
                label="Ngày sinh"
                value={
                  employee.dateOfBirth
                    ? formatDate(employee.dateOfBirth)
                    : NOT_DECLARED
                }
                numeric
              />
              <InfoRow
                label="Giới tính"
                value={
                  employee.gender ? GENDER_LABEL[employee.gender] : NOT_DECLARED
                }
              />
            </InfoCard>

            <InfoCard title="Thông tin công việc" icon={Briefcase}>
              <InfoRow label="Phòng ban" value={department?.name ?? NOT_DECLARED} />
              <InfoRow label="Chức vụ" value={employee.position ?? NOT_DECLARED} />
              <InfoRow
                label="Loại hợp đồng"
                value={
                  employee.contractType
                    ? CONTRACT_TYPE_LABEL[employee.contractType]
                    : NOT_DECLARED
                }
              />
              <InfoRow
                label="Ngày bắt đầu"
                value={formatDate(employee.startDate)}
                numeric
              />
              <InfoRow label="Quản lý trực tiếp" value={manager?.fullName ?? "—"} />
              <InfoRow
                label="Vai trò hệ thống"
                value={SYSTEM_ROLE_LABEL[employee.systemRole]}
              />
              <InfoRow label="Địa điểm làm việc" value={employee.workLocation} />
            </InfoCard>

            <InfoCard title="Hoạt động gần đây" icon={Clock}>
              {attendance.length === 0 ? (
                <p className="py-2 text-sm text-ink-muted">
                  Chưa có dữ liệu chấm công.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {attendance.slice(0, 5).map((record) => (
                    <li
                      key={record.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-hairline px-3 py-2.5"
                    >
                      <span className="num text-sm font-medium text-ink">
                        {formatDate(record.date)}
                      </span>
                      <span className="num text-sm text-ink-secondary">
                        {formatTime(record.checkIn)} – {formatTime(record.checkOut)}
                      </span>
                      <StatusBadge
                        kind="attendance"
                        value={displayAttendanceStatus({
                          status: record.status,
                          checkIn: record.checkIn,
                          checkOut: record.checkOut,
                          date: record.date,
                          today,
                        })}
                        size="sm"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </InfoCard>
          </div>

          <div className="grid gap-4 self-start">
            <section className="surface-card p-4">
              <h2 className="heading-sm mb-3 text-ink">
                Công tháng {month.slice(5)}/{month.slice(0, 4)}
              </h2>
              <dl className="grid grid-cols-2 gap-3">
                <MiniStat label="Ngày công" value={`${summary.workedDays}`} />
                <MiniStat
                  label="Tổng giờ"
                  value={formatDurationShort(summary.totalMinutes)}
                />
                <MiniStat label="Lần đi muộn" value={`${summary.lateCount}`} />
                <MiniStat label="Ngày nghỉ" value={`${summary.leaveDays}`} />
              </dl>
            </section>

            <InfoCard title="Ca làm mặc định" icon={CalendarClock}>
              {shift ? (
                <>
                  <InfoRow label="Tên ca" value={shift.name} />
                  <InfoRow
                    label="Giờ làm"
                    value={formatShiftSchedule(shift)}
                    numeric
                  />
                  <InfoRow
                    label="Nghỉ giữa ca"
                    value={`${shift.breakMinutes} phút`}
                    numeric
                  />
                  <InfoRow
                    label="Cho phép đi muộn"
                    value={`${shift.lateToleranceMinutes} phút`}
                    numeric
                  />
                  {shift.overnight ? (
                    <div className="pt-1">
                      <StatusBadge
                        kind="custom"
                        label="Ca qua đêm"
                        tone="info"
                        icon={CalendarClock}
                        size="sm"
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="py-2 text-sm text-ink-muted">Chưa gán ca làm việc.</p>
              )}
            </InfoCard>
          </div>
        </TabsContent>

        {/* -------------------------------------------------- Cham cong */}
        <TabsContent value="attendance" className="mt-4">
          <section className="surface-card overflow-hidden">
            <header className="border-b border-hairline px-4 py-3.5">
              <h2 className="heading-sm text-ink">Bảng chấm công gần đây</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {formatMonthLabel(month)} và các ngày trước đó
              </p>
            </header>
            {attendance.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Chưa có dữ liệu chấm công"
                description="Bản ghi sẽ xuất hiện khi nhân viên bắt đầu chấm công."
                compact
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày</TableHead>
                      <TableHead>Giờ vào</TableHead>
                      <TableHead>Giờ ra</TableHead>
                      {/* Bang nay liet ke TUNG LUOT (kem anh cua luot do), nen
                          o day la thoi luong tho cua rieng luot — gio nghi
                          duoc tru mot lan cho ca ngay, khong thuoc luot nao.
                          So gio duoc tinh cong xem o the tong hop thang. */}
                      <TableHead>Thời lượng</TableHead>
                      {/* CA CUA CHINH NGAY DO, khong phai ca hien tai cua nhan
                          vien. Doi ca khong sua lich su, nen mot ngay cu van
                          mang ca cu — va khong co cot nay thi "Đi muộn" cua no
                          doc ra nhu mot loi khi nguoi xem dang nhin ca moi o
                          the ben canh. */}
                      <TableHead>Ca</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Địa điểm</TableHead>
                      <TableHead className="text-right">Ảnh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.slice(0, 20).map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="num font-medium text-ink">
                          {formatDate(record.date)}
                        </TableCell>
                        <TableCell className="num">
                          {formatTime(record.checkIn)}
                        </TableCell>
                        <TableCell className="num">
                          {formatTime(record.checkOut)}
                        </TableCell>
                        <TableCell className="num">
                          {record.workedMinutes > 0
                            ? formatDurationShort(record.workedMinutes)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-ink-muted">
                          {shiftNameById.get(record.shiftId) ?? NOT_DECLARED}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            kind="attendance"
                            value={displayAttendanceStatus({
                              status: record.status,
                              checkIn: record.checkIn,
                              checkOut: record.checkOut,
                              date: record.date,
                              today,
                            })}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell className="text-ink-muted">
                          {record.location}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {photoPresence.get(record.id) ? (
                              <span
                                aria-hidden="true"
                                title="Bản ghi có ảnh đính kèm"
                                className="inline-block size-1.5 rounded-full bg-brand"
                              />
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={
                                photoPresence.get(record.id)
                                  ? "Xem ảnh chấm công"
                                  : "Xem ảnh chấm công (chưa có ảnh)"
                              }
                              onClick={() => setPhotoRecordId(record.id)}
                            >
                              <ImageIcon aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </TabsContent>

        {/* -------------------------------------------------- Lich lam viec */}
        <TabsContent value="schedule" className="mt-4">
          <section className="surface-card p-5">
            <h2 className="heading-sm text-ink">Lịch làm việc trong tuần</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Lịch được suy ra từ ca làm mặc định đang áp dụng cho nhân viên.
            </p>

            {shift ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
                  const isWorking = shift.workingDays.includes(day);
                  return (
                    <div
                      key={day}
                      className={
                        isWorking
                          ? "rounded-control border border-brand-subdued bg-brand-wash px-3 py-2.5"
                          : "rounded-control border border-hairline bg-canvas-soft px-3 py-2.5"
                      }
                    >
                      <p className="text-[13px] font-medium text-ink">
                        {WEEKDAY_LABEL[day]}
                      </p>
                      <p className="num mt-0.5 text-xs text-ink-secondary">
                        {isWorking ? formatShiftSchedule(shift) : "Ngày nghỉ"}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">
                Nhân viên chưa được gán ca làm việc.
              </p>
            )}

            {shift ? (
              <p className="mt-4 text-sm text-ink-muted">
                Thời gian làm việc thực tế mỗi ngày:{" "}
                <span className="num font-medium text-ink">
                  {formatDuration(shiftScheduledMinutes(shift))}
                </span>
                {isHoursBasedShift(shift) ? (
                  <>
                    {" "}
                    — ca linh hoạt, nhân viên vào ra lúc nào cũng được nên không
                    tính đi muộn và về sớm.
                  </>
                ) : null}
              </p>
            ) : null}
          </section>
        </TabsContent>

        {/* -------------------------------------------------- Yeu cau */}
        <TabsContent value="requests" className="mt-4">
          <section className="surface-card overflow-hidden">
            <header className="border-b border-hairline px-4 py-3.5">
              <h2 className="heading-sm text-ink">Yêu cầu đã gửi</h2>
            </header>
            {requests.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Chưa có yêu cầu nào"
                description="Nhân viên chưa gửi yêu cầu nghỉ phép hay bổ sung công."
                compact
              />
            ) : (
              <ul className="divide-y divide-hairline">
                {requests.map((request) => (
                  <li key={request.id} className="px-4 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink">
                        {REQUEST_TYPE_LABEL[request.type]}
                      </p>
                      <StatusBadge
                        kind="request"
                        value={request.status}
                        size="sm"
                      />
                    </div>
                    <p className="num mt-1 text-xs text-ink-muted">
                      {formatDate(request.fromDate)}
                      {request.fromDate !== request.toDate
                        ? ` – ${formatDate(request.toDate)}`
                        : ""}
                      {request.fromTime
                        ? ` · ${request.fromTime} – ${request.toTime}`
                        : ""}
                    </p>
                    <p className="mt-1.5 text-sm text-ink-secondary">
                      {request.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* -------------------------------------------------- Luong */}
        {/* PAY-06 (05-2-01): loi hua "giai doan tiep theo" cua V1 duoc dong
            lai o day. Chi owner/admin thay tab nay co noi dung (D-44) — vai
            tro khac nhan 403 o duong doc, nen hien mot khoi noi thang thay vi
            de mot man hinh loi. */}
        <TabsContent value="salary" className="mt-4">
          {isAdminRole ? (
            <div className="grid gap-4">
              <PayRatePanel employeeId={employeeId} today={today} />
              {/* Tien tang ca rieng nam ngay duoi muc luong: hai con so nay
                  luon duoc doc cung nhau khi ai do kiem tra bang luong cua
                  mot nguoi. */}
              <OvertimeRatePanel employeeId={employeeId} today={today} />
            </div>
          ) : (
            <section className="surface-card">
              <EmptyState
                icon={Wallet}
                title="Bạn không có quyền xem thông tin lương."
                description="Chỉ chủ doanh nghiệp và quản trị viên xem được mức lương của nhân viên."
              />
            </section>
          )}
        </TabsContent>
      </Tabs>

      <AttendancePhotoDialog
        attendanceRecordId={photoRecordId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPhotoRecordId(null);
        }}
      />

      {/* Hop thoai chinh sua */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa nhân viên</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin của {employee.fullName}.
            </DialogDescription>
          </DialogHeader>
          <EmployeeForm
            mode="edit"
            companyId={session.companyId}
            employee={employee}
            departments={departments}
            shifts={shifts}
            allEmployees={allEmployees}
            defaultStartDate={today}
            onSaved={(updated) => {
              setIsEditing(false);
              void offerRealign(updated);
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={realignPreview !== null}
        onOpenChange={(open) => {
          // Bam "Giu nguyen" hoac dong hop thoai deu la mot cau tra loi: KHONG.
          // Khong hoi lai lan hai.
          if (!open) setRealignPreview(null);
        }}
        title={SHIFT_REALIGN_LABEL.title}
        description={
          realignPreview === null ? "" : describeRealign(realignPreview)
        }
        confirmLabel={SHIFT_REALIGN_LABEL.confirmLabel}
        cancelLabel={SHIFT_REALIGN_LABEL.cancelLabel}
        onConfirm={handleRealign}
        isPending={isPending}
      />

      <ConfirmDialog
        open={confirmTerminate}
        onOpenChange={setConfirmTerminate}
        title="Đánh dấu nhân viên đã nghỉ việc?"
        description={`${employee.fullName} sẽ không còn xuất hiện trong danh sách chấm công hằng ngày.`}
        confirmLabel="Đánh dấu nghỉ việc"
        tone="destructive"
        isPending={isPending}
        onConfirm={handleTerminate}
      />

      {/* Hop thoai hien mat khau tam MOT LAN DUY NHAT — dong roi khong hien
          lai (T-02-10, prohibition). Khong luu `newAccount` vao dau ke ngoai
          state cua chinh component nay. */}
      <Dialog
        open={newAccount !== null}
        onOpenChange={(open) => {
          if (!open) setNewAccount(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ACCOUNT_LABELS.dialogTitle}</DialogTitle>
            <DialogDescription>{ACCOUNT_LABELS.dialogDescription}</DialogDescription>
          </DialogHeader>
          {newAccount ? (
            <div className="grid gap-3">
              <InfoRow label={ACCOUNT_LABELS.emailLabel} value={newAccount.email} />
              <InfoRow
                label={ACCOUNT_LABELS.temporaryPasswordLabel}
                value={newAccount.temporaryPassword}
                numeric
              />
            </div>
          ) : null}
          <Button onClick={() => setNewAccount(null)}>{ACCOUNT_LABELS.closeButton}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Cau mo ta cua hop thoai xac nhan.
 *
 * Neu ten so ngay VA so ngay dang tinh di muon: nguoi bam phai nhin thay dung
 * thiet hai truoc khi dong y, vi so lieu nay chay thang vao bang luong.
 *
 * Cau cuoi noi ro day la hanh dong MOT LAN — `SETTINGS_SHIFT_LABEL` dang hua
 * "cac ban ghi da co giu nguyen cach phan loai cua ngay hom do", va nguoi dung
 * can biet vi sao lan nay khac.
 */
function describeRealign(preview: ShiftRealignPreview): string {
  const late =
    preview.lateDayCount > 0
      ? `, trong đó ${preview.lateDayCount} ngày đang tính đi muộn`
      : "";

  return (
    `Có ${preview.dayCount} ngày chấm công trong kỳ chưa chốt đang gắn ca cũ${late}. ` +
    `Ca "${preview.shiftName}" không có giờ bắt đầu nên những ngày này sẽ thôi tính đi muộn và về sớm. ` +
    `Ngày thuộc kỳ đã chốt không bị ảnh hưởng.`
  );
}

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="surface-card p-4 sm:p-5">
      <h2 className="heading-sm mb-3 flex items-center gap-2 text-ink">
        <Icon aria-hidden className="size-4 text-ink-muted" />
        {title}
      </h2>
      <dl className="grid gap-2.5">{children}</dl>
    </section>
  );
}

function InfoRow({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd
        className={
          numeric
            ? "num text-right font-medium text-ink"
            : "text-right font-medium text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="rounded-control border border-hairline px-3 py-2.5">
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="num display-md mt-0.5 text-ink">{value}</dd>
    </div>
  );
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="grid gap-6">
      <div className="surface-card flex items-center gap-4 p-5">
        <Skeleton className="size-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-lg rounded-full" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid gap-4 xl:col-span-2">
          <Skeleton className="h-52 rounded-card" />
          <Skeleton className="h-72 rounded-card" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-44 rounded-card" />
          <Skeleton className="h-56 rounded-card" />
        </div>
      </div>
    </div>
  );
}
