import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  ClipboardList,
  Clock3,
  Home,
  LayoutDashboard,
  MapPin,
  Network,
  Receipt,
  Settings,
  ShieldAlert,
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
  { label: "Chấm công", href: "/admin/attendance", icon: Clock3 },
  {
    label: "Cần xem lại",
    href: "/admin/attendance/review",
    icon: ShieldAlert,
  },
  { label: "Yêu cầu", href: "/admin/requests", icon: ClipboardList },
  { label: "Bảng lương", href: "/admin/payroll", icon: Wallet },
  { label: "Cài đặt", href: "/admin/settings", icon: Settings },
];

export interface EmployeeNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Nam muc — thanh dieu huong duoi cua ung dung nhan vien.
 *
 * "Phiếu lương" duoc dat o day chu KHONG chon trong trang Ca nhan, du them mot
 * tab thu nam lam nhan chat hon tren may hep: day la cau hoi nhan vien hoi
 * hang thang, va de no sau mot menu se ha no xuong ngang "Cai dat thong bao".
 *
 * Nhan phai NGAN — `mobile-bottom-nav.tsx` cat mot dong. "Phiếu lương" la hai
 * tu, dai nhat trong nam, va do la gioi han tren cua o nay.
 */
export const EMPLOYEE_NAV_ITEMS: EmployeeNavItem[] = [
  { label: "Trang chủ", href: "/employee", icon: Home },
  { label: "Lịch sử", href: "/employee/history", icon: CalendarClock },
  { label: "Yêu cầu", href: "/employee/requests", icon: ClipboardList },
  { label: "Phiếu lương", href: "/employee/payslips", icon: Receipt },
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
  review: "Cần xem lại",
  requests: "Yêu cầu",
  // Duong dan cu, gio chuyen huong sang /admin/attendance — giu nhan de
  // breadcrumb khong roi ve fallback trong khoanh khac chuyen huong.
  periods: "Kỳ công",
  payroll: "Bảng lương",
  payslips: "Phiếu lương",
  settings: "Cài đặt",
};
