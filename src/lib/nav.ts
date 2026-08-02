import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  ClipboardList,
  Clock3,
  Home,
  LayoutDashboard,
  MapPin,
  Network,
  Settings,
  User,
  Users,
  Wallet,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Chuc nang chua mo trong giai doan nay */
  comingSoon?: boolean;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Tổng quan", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Nhân viên", href: "/admin/employees", icon: Users },
  { label: "Phòng ban", href: "/admin/departments", icon: Network },
  { label: "Ca làm việc", href: "/admin/shifts", icon: CalendarClock },
  { label: "Điểm làm việc", href: "/admin/work-sites", icon: MapPin },
  {
    label: "Chấm công",
    href: "/admin/attendance",
    icon: Clock3,
    comingSoon: true,
  },
  { label: "Bảng lương", href: "/admin/payroll", icon: Wallet, comingSoon: true },
  { label: "Cài đặt", href: "/admin/settings", icon: Settings, comingSoon: true },
];

export interface EmployeeNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const EMPLOYEE_NAV_ITEMS: EmployeeNavItem[] = [
  { label: "Trang chủ", href: "/employee", icon: Home },
  { label: "Lịch sử", href: "/employee/history", icon: CalendarClock },
  { label: "Yêu cầu", href: "/employee/requests", icon: ClipboardList },
  { label: "Cá nhân", href: "/employee/profile", icon: User },
];

/** Nhan breadcrumb theo tung doan duong dan */
export const BREADCRUMB_LABELS: Record<string, string> = {
  admin: "Quản trị",
  dashboard: "Tổng quan",
  employees: "Nhân viên",
  new: "Thêm nhân viên",
  departments: "Phòng ban",
  shifts: "Ca làm việc",
  // Doan co dau "-" nen thieu entry se bi fallback nham thanh "Chi tiết"
  // (xem admin-topbar.tsx dong 43-44) — phai khai tuong minh.
  "work-sites": "Điểm làm việc",
  attendance: "Chấm công",
  payroll: "Bảng lương",
  settings: "Cài đặt",
};
