/**
 * Kieu du lieu nghiep vu cua TimeFlow.
 *
 * Cac union type duoi day duoc thiet ke de anh xa 1-1 sang cot enum trong
 * Postgres/Supabase o giai doan sau, nen gia tri luu tru dung tieng Anh
 * con nhan hien thi tieng Viet nam trong `lib/constants.ts`.
 */

/* -------------------------------------------------------------------------- */
/* Enum nghiep vu                                                             */
/* -------------------------------------------------------------------------- */

export type EmployeeStatus =
  | "active"
  | "on_leave"
  | "terminated"
  | "pending_invite";

export type ContractType =
  | "full_time"
  | "part_time"
  | "probation"
  | "seasonal"
  | "intern";

export type Gender = "male" | "female" | "other";

export type AttendanceStatus =
  | "on_time"
  | "late"
  | "early_leave"
  | "missing_checkout"
  | "leave_paid"
  | "leave_unpaid"
  | "day_off";

export type RequestType =
  | "leave"
  | "attendance_supplement"
  | "time_adjustment"
  | "overtime";

export type RequestStatus = "pending" | "approved" | "rejected";

export type SystemRole = "owner" | "admin" | "manager" | "employee";

export type CompanyRole = "owner" | "admin" | "manager" | "employee";

export type DepartmentStatus = "active" | "inactive";

export type ShiftStatus = "active" | "archived";

/** Trang thai cham cong trong ngay cua man hinh nhan vien */
export type CheckInState = "not_started" | "working" | "finished";

export type CompanySize = "1-10" | "11-30" | "31-100" | "101-500" | "500+";

/** 1 = Thu Hai ... 7 = Chu Nhat (theo quy uoc ISO) */
export type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/* -------------------------------------------------------------------------- */
/* Thuc the                                                                    */
/* -------------------------------------------------------------------------- */

export interface Company {
  id: string;
  name: string;
  code: string;
  industry: string;
  size: CompanySize;
  phone: string;
  address: string;
  /** Vai tro cua nguoi dung dang dang nhap trong doanh nghiep nay */
  role: CompanyRole;
  employeeCount: number;
  /** ISO date-time, vi du "2026-07-26T17:32:00+07:00" */
  lastAccessedAt: string;
  /** Mau nen cho chu cai dai dien, dung token thuong hieu */
  accent: "indigo" | "navy" | "ruby" | "cream";
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  description: string;
  /** id cua nhan vien giu vai tro quan ly */
  managerId: string | null;
  status: DepartmentStatus;
}

export interface Shift {
  id: string;
  companyId: string;
  name: string;
  code: string;
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm" — co the nho hon startTime neu la ca qua dem */
  endTime: string;
  breakMinutes: number;
  /** So phut cho phep di muon ma van tinh dung gio */
  lateToleranceMinutes: number;
  /** Ca ket thuc vao ngay hom sau */
  overnight: boolean;
  workingDays: WeekdayNumber[];
  status: ShiftStatus;
}

export interface Employee {
  id: string;
  companyId: string;
  /** Ma nhan vien hien thi, vi du "NV001" */
  code: string;
  fullName: string;
  email: string;
  phone: string;
  /** "YYYY-MM-DD" */
  dateOfBirth: string;
  gender: Gender;
  avatarUrl: string | null;

  departmentId: string;
  position: string;
  contractType: ContractType;
  /** "YYYY-MM-DD" */
  startDate: string;
  managerId: string | null;
  shiftId: string;
  workLocation: string;

  status: EmployeeStatus;
  systemRole: SystemRole;
  invitationSent: boolean;
  canViewPayslip: boolean;
  canCheckInRemotely: boolean;
}

export interface AttendanceRecord {
  id: string;
  companyId: string;
  employeeId: string;
  /** "YYYY-MM-DD" */
  date: string;
  shiftId: string;
  /** "HH:mm" hoac null neu chua cham cong */
  checkIn: string | null;
  checkOut: string | null;
  /** Tong so phut lam viec thuc te (da tru gio nghi) */
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: AttendanceStatus;
  location: string;
  /** Ban ghi can nhan vien bo sung thong tin */
  needsSupplement: boolean;
  note: string | null;
}

export interface WorkRequest {
  id: string;
  companyId: string;
  employeeId: string;
  type: RequestType;
  status: RequestStatus;
  /** "YYYY-MM-DD" */
  fromDate: string;
  toDate: string;
  /** Chi dung cho yeu cau dieu chinh gio / bo sung cong */
  fromTime: string | null;
  toTime: string | null;
  reason: string;
  /** ISO date-time */
  createdAt: string;
  reviewerId: string | null;
  reviewNote: string | null;
}

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  /** Ma nhan vien tuong ung tren man hinh nhan vien */
  employeeId: string;
}

export interface UserSession {
  user: AppUser;
  companyId: string;
  role: CompanyRole;
  /** ISO date-time */
  signedInAt: string;
}

/* -------------------------------------------------------------------------- */
/* Truy van & ket qua                                                          */
/* -------------------------------------------------------------------------- */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EmployeeQuery {
  companyId: string;
  search?: string;
  departmentId?: string | "all";
  status?: EmployeeStatus | "all";
  contractType?: ContractType | "all";
  page?: number;
  pageSize?: number;
}

export interface AttendanceQuery {
  companyId: string;
  employeeId?: string;
  /** "YYYY-MM" */
  month?: string;
  /** "YYYY-MM-DD" */
  date?: string;
}

export interface RequestQuery {
  companyId: string;
  employeeId?: string;
  status?: RequestStatus | "all";
}

/* -------------------------------------------------------------------------- */
/* Du lieu tong hop cho dashboard                                              */
/* -------------------------------------------------------------------------- */

export interface KpiValue {
  value: number;
  /** Chenh lech so voi ngay truoc; duong la tang */
  delta: number;
}

export interface AttendanceChartPoint {
  /** "YYYY-MM-DD" */
  date: string;
  /** Nhan truc hien thi, vi du "T2 21/07" */
  label: string;
  present: number;
  late: number;
  absent: number;
}

export interface TodayActivityItem {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  avatarUrl: string | null;
  checkIn: string | null;
  status: AttendanceStatus;
  location: string;
}

export interface PendingRequestSummary {
  type: RequestType;
  count: number;
}

export interface DashboardSummary {
  date: string;
  totalEmployees: KpiValue;
  checkedIn: KpiValue;
  late: KpiValue;
  onLeave: KpiValue;
  chart: AttendanceChartPoint[];
  todayActivity: TodayActivityItem[];
  pendingRequests: PendingRequestSummary[];
  notCheckedIn: Array<{
    employeeId: string;
    employeeName: string;
    departmentName: string;
    avatarUrl: string | null;
    phone: string;
    shiftName: string;
  }>;
}

/** Tong hop cong thang cua mot nhan vien */
export interface MonthlySummary {
  /** "YYYY-MM" */
  month: string;
  workedDays: number;
  totalMinutes: number;
  lateCount: number;
  leaveDays: number;
}

/* -------------------------------------------------------------------------- */
/* Input cho cac thao tac ghi                                                  */
/* -------------------------------------------------------------------------- */

export type EmployeeInput = Omit<Employee, "id" | "companyId">;

export type DepartmentInput = Omit<Department, "id" | "companyId">;

export type ShiftInput = Omit<Shift, "id" | "companyId">;

export type WorkRequestInput = Pick<
  WorkRequest,
  "type" | "fromDate" | "toDate" | "fromTime" | "toTime" | "reason"
>;

export interface CompanyInput {
  name: string;
  code: string;
  industry: string;
  size: CompanySize;
  phone: string;
  address: string;
}
