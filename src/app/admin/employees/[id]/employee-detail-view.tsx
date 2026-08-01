"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Clock,
  Mail,
  MailPlus,
  MoreHorizontal,
  Network,
  Pencil,
  UserMinus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeForm } from "@/components/employees/employee-form";
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
import { useMockQuery } from "@/hooks/use-mock-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import {
  CONTRACT_TYPE_LABEL,
  GENDER_LABEL,
  REFERENCE_MONTH,
  REQUEST_TYPE_LABEL,
  SYSTEM_ROLE_LABEL,
  WEEKDAY_LABEL,
} from "@/lib/constants";
import {
  formatDate,
  formatDuration,
  formatDurationShort,
  formatMonthLabel,
  formatTime,
  minutesBetween,
} from "@/lib/format";
import { listDepartments } from "@/lib/data/departments";
import { getEmployee, listAllEmployees, updateEmployee } from "@/lib/data/employees";
import { listShifts } from "@/lib/data/shifts";
import {
  getMonthlySummary,
  listAttendance,
  listRequests,
} from "@/lib/mock/service";
import { useMockData } from "@/lib/mock/store";

export function EmployeeDetailView({
  employeeId,
}: {
  employeeId: string;
}): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useMockData();
  const [isEditing, setIsEditing] = React.useState(false);
  const [confirmTerminate, setConfirmTerminate] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const { data, isLoading, error, reload } = useMockQuery(
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
          getMonthlySummary(session.companyId, employeeId, REFERENCE_MONTH),
        ]);

      return {
        employee,
        departments,
        shifts,
        allEmployees,
        attendance,
        requests,
        summary,
      };
    },
    [employeeId, session.companyId],
  );

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

  const { employee, departments, shifts, allEmployees, attendance, requests, summary } =
    data;
  const department = departments.find((item) => item.id === employee.departmentId);
  const shift = shifts.find((item) => item.id === employee.shiftId);
  const manager = allEmployees.find((item) => item.id === employee.managerId);

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
              <InfoRow label="Số điện thoại" value={employee.phone} numeric />
              <InfoRow
                label="Ngày sinh"
                value={formatDate(employee.dateOfBirth)}
                numeric
              />
              <InfoRow label="Giới tính" value={GENDER_LABEL[employee.gender]} />
            </InfoCard>

            <InfoCard title="Thông tin công việc" icon={Briefcase}>
              <InfoRow label="Phòng ban" value={department?.name ?? "—"} />
              <InfoRow label="Chức vụ" value={employee.position} />
              <InfoRow
                label="Loại hợp đồng"
                value={CONTRACT_TYPE_LABEL[employee.contractType]}
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
                        value={record.status}
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
                Công tháng {REFERENCE_MONTH.slice(5)}/{REFERENCE_MONTH.slice(0, 4)}
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
                    value={`${shift.startTime} – ${shift.endTime}`}
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
                {formatMonthLabel(REFERENCE_MONTH)} và các ngày trước đó
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
                      <TableHead>Tổng giờ</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Địa điểm</TableHead>
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
                        <TableCell>
                          <StatusBadge
                            kind="attendance"
                            value={record.status}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell className="text-ink-muted">
                          {record.location}
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
                        {isWorking
                          ? `${shift.startTime} – ${shift.endTime}`
                          : "Ngày nghỉ"}
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
                  {formatDuration(
                    Math.max(
                      minutesBetween(shift.startTime, shift.endTime) -
                        shift.breakMinutes,
                      0,
                    ),
                  )}
                </span>
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
        <TabsContent value="salary" className="mt-4">
          <section className="surface-card">
            <EmptyState
              icon={Wallet}
              title="Thông tin lương sẽ được thiết lập trong giai đoạn tiếp theo."
              description="Khi tính năng bảng lương ra mắt, bạn sẽ cấu hình mức lương, phụ cấp và các khoản khấu trừ tại đây."
            />
          </section>
        </TabsContent>
      </Tabs>

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
          />
        </DialogContent>
      </Dialog>

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
    </div>
  );
}

/* -------------------------------------------------------------------------- */

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
