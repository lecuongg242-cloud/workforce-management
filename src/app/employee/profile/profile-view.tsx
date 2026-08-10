"use client";

import * as React from "react";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import {
  useEmployeeSession,
  useSession,
} from "@/lib/auth/session-provider";
import { NOT_DECLARED } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { formatShiftLabel } from "@/lib/shifts/schedule";
import { listDepartments } from "@/lib/data/departments";
import { getEmployee } from "@/lib/data/employees";
import { listShifts } from "@/lib/data/shifts";

export function ProfileView(): React.ReactElement {
  const { session, employeeId } = useEmployeeSession();
  const { signOut } = useSession();
  const [confirmSignOut, setConfirmSignOut] = React.useState(false);

  const { data, isLoading, error, reload } = useDataQuery(
    async () => {
      const [employee, departments, shifts] = await Promise.all([
        getEmployee(employeeId),
        listDepartments(session.companyId),
        listShifts(session.companyId),
      ]);
      return { employee, departments, shifts };
    },
    [employeeId, session.companyId],
  );

  const employee = data?.employee ?? null;
  const department = data?.departments.find(
    (item) => item.id === employee?.departmentId,
  );
  const shift = data?.shifts.find((item) => item.id === employee?.shiftId);

  const menu: Array<{ icon: LucideIcon; label: string; onClick: () => void }> = [
    {
      icon: UserRound,
      label: "Thông tin cá nhân",
      onClick: () =>
        toast.info("Chỉnh sửa thông tin cá nhân sẽ có ở giai đoạn tiếp theo."),
    },
    {
      icon: KeyRound,
      label: "Đổi mật khẩu",
      onClick: () => toast.info("Đổi mật khẩu sẽ có khi kết nối máy chủ thật."),
    },
    {
      icon: Bell,
      label: "Cài đặt thông báo",
      onClick: () => toast.info("Cài đặt thông báo sẽ có ở giai đoạn tiếp theo."),
    },
    {
      icon: CircleHelp,
      label: "Trợ giúp",
      onClick: () => toast.info("Liên hệ quản trị viên của doanh nghiệp để được hỗ trợ."),
    },
  ];

  if (error) {
    return <ErrorState description={error} onRetry={reload} />;
  }

  return (
    <div className="grid gap-4">
      <h1 className="display-md text-ink">Hồ sơ</h1>

      {isLoading || !employee ? (
        <>
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-44 w-full rounded-card" />
          <Skeleton className="h-56 w-full rounded-card" />
        </>
      ) : (
        <>
          {/* Khoi ho so */}
          <section className="surface-card p-5 text-center">
            <EmployeeAvatar
              name={employee.fullName}
              avatarUrl={employee.avatarUrl}
              size="xl"
              className="mx-auto"
            />
            <h2 className="heading-lg mt-3 text-ink">{employee.fullName}</h2>
            <p className="num mt-0.5 text-[13px] text-ink-muted">{employee.code}</p>
            <div className="mt-2.5 flex justify-center">
              <StatusBadge kind="employee" value={employee.status} size="sm" />
            </div>
          </section>

          {/* Thong tin */}
          <section className="surface-card p-4">
            <h2 className="heading-sm mb-3 text-ink">Thông tin công việc</h2>
            <dl className="grid gap-2.5 text-[13px]">
              <Row label="Phòng ban" value={department?.name ?? "—"} />
              <Row label="Chức vụ" value={employee.position ?? NOT_DECLARED} />
              <Row
                label="Ca mặc định"
                value={
                  shift ? formatShiftLabel(shift) : "—"
                }
                numeric
              />
              <Row
                label="Ngày bắt đầu"
                value={formatDate(employee.startDate)}
                numeric
              />
              <Row label="Địa điểm làm việc" value={employee.workLocation} />
            </dl>
          </section>

          <section className="surface-card p-4">
            <h2 className="heading-sm mb-3 text-ink">Liên hệ</h2>
            <ul className="grid gap-2.5">
              <li className="flex items-center gap-2.5">
                <Mail aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                <a
                  href={`mailto:${employee.email}`}
                  className="min-w-0 flex-1 truncate rounded-sm text-[13px] text-ink hover:text-brand"
                >
                  {employee.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone
                  aria-hidden="true"
                  className="size-4 shrink-0 text-ink-muted"
                />
                <a
                  href={`tel:${employee.phone}`}
                  className="num min-w-0 flex-1 truncate rounded-sm text-[13px] text-ink hover:text-brand"
                >
                  {employee.phone}
                </a>
              </li>
            </ul>
          </section>

          {/* Menu */}
          <section className="surface-card overflow-hidden">
            <ul className="divide-y divide-hairline">
              {menu.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={item.onClick}
                      className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas-soft"
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-ink-muted"
                      />
                      <span className="flex-1 text-[14px] text-ink">
                        {item.label}
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-ink-muted"
                      />
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(true)}
                  className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-danger-soft"
                >
                  <LogOut aria-hidden="true" className="size-4 shrink-0 text-danger" />
                  <span className="flex-1 text-[14px] font-medium text-danger">
                    Đăng xuất
                  </span>
                </button>
              </li>
            </ul>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Đăng xuất khỏi TimeFlow?"
        description="Bạn sẽ cần đăng nhập lại để chấm công và gửi yêu cầu."
        confirmLabel="Đăng xuất"
        tone="destructive"
        onConfirm={() => {
          setConfirmSignOut(false);
          void signOut();
        }}
      />
    </div>
  );
}

function Row({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-3">
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
