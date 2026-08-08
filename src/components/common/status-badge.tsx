import * as React from "react";
import {
  AlertTriangle,
  Ban,
  CalendarOff,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  LogOut,
  MailQuestion,
  Palmtree,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_TONE,
  DEPARTMENT_STATUS_LABEL,
  DEPARTMENT_STATUS_TONE,
  EMPLOYEE_STATUS_LABEL,
  EMPLOYEE_STATUS_TONE,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  SHIFT_STATUS_LABEL,
  SHIFT_STATUS_TONE,
  type SemanticTone,
} from "@/lib/constants";
import type { AttendanceDisplayStatus } from "@/lib/attendance/display-status";
import type {
  DepartmentStatus,
  EmployeeStatus,
  RequestStatus,
  ShiftStatus,
} from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/**
 * Mot component duy nhat cho moi loai trang thai trong ung dung.
 * Luon hien thi ca bieu tuong lan chu — khong dung mau lam dau hieu duy nhat.
 */

const toneClass: Record<SemanticTone, string> = {
  success: "bg-success-soft text-success border-success-border",
  warning: "bg-warning-soft text-warning border-warning-border",
  danger: "bg-danger-soft text-danger border-danger-border",
  info: "bg-info-soft text-info border-info-border",
  neutral: "bg-neutral-soft text-neutral-ink border-neutral-border",
  brand: "bg-brand-wash text-brand-deep border-brand-subdued",
};

const employeeIcon: Record<EmployeeStatus, LucideIcon> = {
  active: CheckCircle2,
  on_leave: Palmtree,
  terminated: LogOut,
  pending_invite: MailQuestion,
};

const attendanceIcon: Record<AttendanceDisplayStatus, LucideIcon> = {
  on_time: CheckCircle2,
  late: Clock,
  early_leave: LogOut,
  missing_checkout: AlertTriangle,
  leave_paid: Palmtree,
  leave_unpaid: Ban,
  day_off: CalendarOff,
  // Vong tron dang chay — mot ngay chua khep lai, khong phai mot ket luan.
  working: CircleDashed,
};

const requestIcon: Record<RequestStatus, LucideIcon> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

export type StatusBadgeProps =
  | { kind: "employee"; value: EmployeeStatus; size?: BadgeSize; className?: string }
  | {
      kind: "attendance";
      value: AttendanceDisplayStatus;
      size?: BadgeSize;
      className?: string;
    }
  | { kind: "request"; value: RequestStatus; size?: BadgeSize; className?: string }
  | {
      kind: "department";
      value: DepartmentStatus;
      size?: BadgeSize;
      className?: string;
    }
  | { kind: "shift"; value: ShiftStatus; size?: BadgeSize; className?: string }
  | {
      kind: "custom";
      label: string;
      tone: SemanticTone;
      icon?: LucideIcon;
      size?: BadgeSize;
      className?: string;
    };

type BadgeSize = "sm" | "md";

function resolve(props: StatusBadgeProps): {
  label: string;
  tone: SemanticTone;
  Icon: LucideIcon;
} {
  switch (props.kind) {
    case "employee":
      return {
        label: EMPLOYEE_STATUS_LABEL[props.value],
        tone: EMPLOYEE_STATUS_TONE[props.value],
        Icon: employeeIcon[props.value],
      };
    case "attendance":
      return {
        label: ATTENDANCE_STATUS_LABEL[props.value],
        tone: ATTENDANCE_STATUS_TONE[props.value],
        Icon: attendanceIcon[props.value],
      };
    case "request":
      return {
        label: REQUEST_STATUS_LABEL[props.value],
        tone: REQUEST_STATUS_TONE[props.value],
        Icon: requestIcon[props.value],
      };
    case "department":
      return {
        label: DEPARTMENT_STATUS_LABEL[props.value],
        tone: DEPARTMENT_STATUS_TONE[props.value],
        Icon: props.value === "active" ? CheckCircle2 : CircleDot,
      };
    case "shift":
      return {
        label: SHIFT_STATUS_LABEL[props.value],
        tone: SHIFT_STATUS_TONE[props.value],
        Icon: props.value === "active" ? CheckCircle2 : CircleDot,
      };
    case "custom":
      return {
        label: props.label,
        tone: props.tone,
        Icon: props.icon ?? CircleDot,
      };
  }
}

export function StatusBadge(props: StatusBadgeProps): React.ReactElement {
  const { label, tone, Icon } = resolve(props);
  const size = props.size ?? "md";

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        toneClass[tone],
        props.className,
      )}
    >
      <Icon aria-hidden="true" className={size === "sm" ? "size-3" : "size-3.5"} />
      {label}
    </span>
  );
}
