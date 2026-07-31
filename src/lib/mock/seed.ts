import { REFERENCE_DATE } from "@/lib/constants";
import { addDays, minutesBetween } from "@/lib/format";
import type {
  AppUser,
  AttendanceRecord,
  AttendanceStatus,
  Company,
  ContractType,
  Department,
  Employee,
  EmployeeStatus,
  Gender,
  Shift,
  SystemRole,
  WeekdayNumber,
  WorkRequest,
} from "@/lib/types/domain";

/**
 * Du lieu mau — hoan toan tinh (khong Math.random, khong Date.now) de:
 *  - server va client render giong het nhau (khong loi hydration);
 *  - so lieu demo on dinh giua cac lan tai trang.
 *
 * Toan bo cau truc khong gioi han so nhan vien; 28 chi la so luong mau.
 */

export const CURRENT_COMPANY_ID = "cty-01";
export const SECOND_COMPANY_ID = "cty-02";

/* -------------------------------------------------------------------------- */
/* Nguoi dung dang dang nhap                                                   */
/* -------------------------------------------------------------------------- */

export const seedUser: AppUser = {
  id: "usr-01",
  fullName: "Nguyễn Văn Quân",
  email: "quan.nguyen@ngocphat.vn",
  avatarUrl: null,
  // Tren man hinh nhan vien, tai khoan demo gan voi Nguyen Minh Anh
  employeeId: "nv-01",
};

/* -------------------------------------------------------------------------- */
/* Doanh nghiep                                                                */
/* -------------------------------------------------------------------------- */

export const seedCompanies: Company[] = [
  {
    id: CURRENT_COMPANY_ID,
    name: "Công ty TNHH Thương mại Ngọc Phát",
    code: "NGOCPHAT",
    industry: "retail",
    size: "11-30",
    phone: "028 3822 4567",
    address: "142 Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh",
    role: "owner",
    employeeCount: 28,
    lastAccessedAt: "2026-07-27T07:42:00+07:00",
    accent: "indigo",
  },
  {
    id: SECOND_COMPANY_ID,
    name: "Xưởng Sản xuất Bình Minh",
    code: "BINHMINH",
    industry: "manufacturing",
    size: "31-100",
    phone: "0274 3756 118",
    address: "Lô C7, KCN Sóng Thần, Dĩ An, Bình Dương",
    role: "manager",
    // Gia tri nay duoc tinh lai theo du lieu that trong `listCompanies`
    employeeCount: 0,
    lastAccessedAt: "2026-07-21T16:10:00+07:00",
    accent: "navy",
  },
];

/* -------------------------------------------------------------------------- */
/* Phong ban                                                                   */
/* -------------------------------------------------------------------------- */

export const seedDepartments: Department[] = [
  {
    id: "pb-01",
    companyId: CURRENT_COMPANY_ID,
    name: "Ban giám đốc",
    description: "Điều hành chung, hoạch định chiến lược và phê duyệt ngân sách.",
    managerId: "nv-02",
    status: "active",
  },
  {
    id: "pb-02",
    companyId: CURRENT_COMPANY_ID,
    name: "Kinh doanh",
    description: "Phát triển khách hàng, chăm sóc đại lý và triển khai doanh số.",
    managerId: "nv-05",
    status: "active",
  },
  {
    id: "pb-03",
    companyId: CURRENT_COMPANY_ID,
    name: "Kế toán",
    description: "Quản lý thu chi, công nợ, hóa đơn và báo cáo tài chính.",
    managerId: "nv-11",
    status: "active",
  },
  {
    id: "pb-04",
    companyId: CURRENT_COMPANY_ID,
    name: "Kho vận",
    description: "Nhập xuất hàng hóa, kiểm kê tồn kho và điều phối giao nhận.",
    managerId: "nv-16",
    status: "active",
  },
  {
    id: "pb-05",
    companyId: CURRENT_COMPANY_ID,
    name: "Sản xuất",
    description: "Vận hành dây chuyền, kiểm soát chất lượng và bảo trì thiết bị.",
    managerId: "nv-21",
    status: "active",
  },
];

/* -------------------------------------------------------------------------- */
/* Ca lam viec                                                                 */
/* -------------------------------------------------------------------------- */

const WEEKDAYS_MON_SAT: WeekdayNumber[] = [1, 2, 3, 4, 5, 6];
const WEEKDAYS_MON_FRI: WeekdayNumber[] = [1, 2, 3, 4, 5];
const WEEKDAYS_ALL: WeekdayNumber[] = [1, 2, 3, 4, 5, 6, 7];

export const seedShifts: Shift[] = [
  {
    id: "ca-01",
    companyId: CURRENT_COMPANY_ID,
    name: "Ca hành chính",
    code: "HC",
    startTime: "08:00",
    endTime: "17:30",
    breakMinutes: 90,
    lateToleranceMinutes: 5,
    overnight: false,
    workingDays: WEEKDAYS_MON_FRI,
    status: "active",
  },
  {
    id: "ca-02",
    companyId: CURRENT_COMPANY_ID,
    name: "Ca sáng",
    code: "S1",
    startTime: "06:00",
    endTime: "14:00",
    breakMinutes: 30,
    lateToleranceMinutes: 10,
    overnight: false,
    workingDays: WEEKDAYS_MON_SAT,
    status: "active",
  },
  {
    id: "ca-03",
    companyId: CURRENT_COMPANY_ID,
    name: "Ca chiều",
    code: "C1",
    startTime: "14:00",
    endTime: "22:00",
    breakMinutes: 30,
    lateToleranceMinutes: 10,
    overnight: false,
    workingDays: WEEKDAYS_MON_SAT,
    status: "active",
  },
  {
    id: "ca-04",
    companyId: CURRENT_COMPANY_ID,
    name: "Ca đêm",
    code: "D1",
    startTime: "22:00",
    endTime: "06:00",
    breakMinutes: 45,
    lateToleranceMinutes: 10,
    overnight: true,
    workingDays: WEEKDAYS_ALL,
    status: "active",
  },
];

/* -------------------------------------------------------------------------- */
/* Nhan vien                                                                   */
/* -------------------------------------------------------------------------- */

interface EmployeeSeed {
  fullName: string;
  departmentId: string;
  position: string;
  contractType: ContractType;
  startDate: string;
  gender: Gender;
  dateOfBirth: string;
  status: EmployeeStatus;
  systemRole: SystemRole;
  shiftId: string;
  workLocation: string;
  managerId: string | null;
}

const employeeSeeds: EmployeeSeed[] = [
  {
    fullName: "Nguyễn Minh Anh",
    departmentId: "pb-02",
    position: "Nhân viên kinh doanh",
    contractType: "full_time",
    startDate: "2023-03-06",
    gender: "female",
    dateOfBirth: "1997-04-12",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-01",
    workLocation: "Văn phòng chính",
    managerId: "nv-05",
  },
  {
    fullName: "Trần Hoàng Nam",
    departmentId: "pb-01",
    position: "Giám đốc điều hành",
    contractType: "full_time",
    startDate: "2019-01-02",
    gender: "male",
    dateOfBirth: "1983-09-25",
    status: "active",
    systemRole: "owner",
    shiftId: "ca-01",
    workLocation: "Văn phòng chính",
    managerId: null,
  },
  {
    fullName: "Lê Thu Hương",
    departmentId: "pb-03",
    position: "Kế toán tổng hợp",
    contractType: "full_time",
    startDate: "2021-06-14",
    gender: "female",
    dateOfBirth: "1993-11-03",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-01",
    workLocation: "Văn phòng chính",
    managerId: "nv-11",
  },
  {
    fullName: "Phạm Quốc Khánh",
    departmentId: "pb-04",
    position: "Nhân viên kho",
    contractType: "full_time",
    startDate: "2022-08-01",
    gender: "male",
    dateOfBirth: "1995-02-18",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-02",
    workLocation: "Kho Long An",
    managerId: "nv-16",
  },
  {
    fullName: "Vũ Ngọc Mai",
    departmentId: "pb-02",
    position: "Trưởng phòng kinh doanh",
    contractType: "full_time",
    startDate: "2020-02-17",
    gender: "female",
    dateOfBirth: "1990-07-30",
    status: "active",
    systemRole: "manager",
    shiftId: "ca-01",
    workLocation: "Văn phòng chính",
    managerId: "nv-02",
  },
  {
    fullName: "Đỗ Văn Thành",
    departmentId: "pb-05",
    position: "Công nhân vận hành",
    contractType: "full_time",
    startDate: "2022-04-11",
    gender: "male",
    dateOfBirth: "1994-12-05",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-03",
    workLocation: "Nhà máy Bình Dương",
    managerId: "nv-21",
  },
  {
    fullName: "Bùi Thị Lan Phương",
    departmentId: "pb-02",
    position: "Nhân viên chăm sóc khách hàng",
    contractType: "full_time",
    startDate: "2023-09-18",
    gender: "female",
    dateOfBirth: "1998-06-21",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-01",
    workLocation: "Văn phòng chính",
    managerId: "nv-05",
  },
  {
    fullName: "Hoàng Đức Duy",
    departmentId: "pb-02",
    position: "Nhân viên kinh doanh",
    contractType: "probation",
    startDate: "2026-06-15",
    gender: "male",
    dateOfBirth: "2001-01-09",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-01",
    workLocation: "Chi nhánh Quận 7",
    managerId: "nv-05",
  },
  {
    fullName: "Ngô Thanh Tuyền",
    departmentId: "pb-02",
    position: "Nhân viên telesales",
    contractType: "part_time",
    startDate: "2025-03-03",
    gender: "female",
    dateOfBirth: "2000-10-14",
    status: "on_leave",
    systemRole: "employee",
    shiftId: "ca-03",
    workLocation: "Làm việc từ xa",
    managerId: "nv-05",
  },
  {
    fullName: "Đặng Hữu Tài",
    departmentId: "pb-02",
    position: "Giám sát bán hàng",
    contractType: "full_time",
    startDate: "2021-11-08",
    gender: "male",
    dateOfBirth: "1992-03-27",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-01",
    workLocation: "Chi nhánh Quận 7",
    managerId: "nv-05",
  },
  {
    fullName: "Trịnh Bảo Châu",
    departmentId: "pb-03",
    position: "Kế toán trưởng",
    contractType: "full_time",
    startDate: "2019-05-20",
    gender: "female",
    dateOfBirth: "1987-08-08",
    status: "active",
    systemRole: "manager",
    shiftId: "ca-01",
    workLocation: "Văn phòng chính",
    managerId: "nv-02",
  },
  {
    fullName: "Lý Gia Huy",
    departmentId: "pb-03",
    position: "Kế toán công nợ",
    contractType: "full_time",
    startDate: "2023-01-16",
    gender: "male",
    dateOfBirth: "1996-05-19",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-01",
    workLocation: "Văn phòng chính",
    managerId: "nv-11",
  },
  {
    fullName: "Cao Thị Kim Ngân",
    departmentId: "pb-03",
    position: "Kế toán kho",
    contractType: "full_time",
    startDate: "2024-07-01",
    gender: "female",
    dateOfBirth: "1999-09-02",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-01",
    workLocation: "Kho Long An",
    managerId: "nv-11",
  },
  {
    fullName: "Nguyễn Hải Đăng",
    departmentId: "pb-03",
    position: "Thực tập sinh kế toán",
    contractType: "intern",
    startDate: "2026-05-04",
    gender: "male",
    dateOfBirth: "2004-02-11",
    status: "pending_invite",
    systemRole: "employee",
    shiftId: "ca-01",
    workLocation: "Văn phòng chính",
    managerId: "nv-11",
  },
  {
    fullName: "Trương Mỹ Duyên",
    departmentId: "pb-04",
    position: "Nhân viên chứng từ",
    contractType: "full_time",
    startDate: "2022-12-05",
    gender: "female",
    dateOfBirth: "1995-12-24",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-02",
    workLocation: "Kho Long An",
    managerId: "nv-16",
  },
  {
    fullName: "Phan Trọng Nghĩa",
    departmentId: "pb-04",
    position: "Trưởng kho",
    contractType: "full_time",
    startDate: "2020-09-14",
    gender: "male",
    dateOfBirth: "1989-04-04",
    status: "active",
    systemRole: "manager",
    shiftId: "ca-02",
    workLocation: "Kho Long An",
    managerId: "nv-02",
  },
  {
    fullName: "Võ Thành Luân",
    departmentId: "pb-04",
    position: "Tài xế giao hàng",
    contractType: "seasonal",
    startDate: "2026-02-09",
    gender: "male",
    dateOfBirth: "1997-07-16",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-02",
    workLocation: "Kho Long An",
    managerId: "nv-16",
  },
  {
    fullName: "Huỳnh Nhật Minh",
    departmentId: "pb-04",
    position: "Nhân viên bốc xếp",
    contractType: "part_time",
    startDate: "2025-10-20",
    gender: "male",
    dateOfBirth: "2002-08-30",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-03",
    workLocation: "Kho Long An",
    managerId: "nv-16",
  },
  {
    fullName: "Dương Khánh Vy",
    departmentId: "pb-04",
    position: "Nhân viên kiểm kê",
    contractType: "full_time",
    startDate: "2024-03-11",
    gender: "female",
    dateOfBirth: "1998-01-28",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-02",
    workLocation: "Kho Long An",
    managerId: "nv-16",
  },
  {
    fullName: "Tô Anh Kiệt",
    departmentId: "pb-04",
    position: "Nhân viên điều phối",
    contractType: "full_time",
    startDate: "2023-06-26",
    gender: "male",
    dateOfBirth: "1994-10-07",
    status: "terminated",
    systemRole: "employee",
    shiftId: "ca-02",
    workLocation: "Kho Long An",
    managerId: "nv-16",
  },
  {
    fullName: "Lâm Thị Bích Hạnh",
    departmentId: "pb-05",
    position: "Quản đốc phân xưởng",
    contractType: "full_time",
    startDate: "2019-10-01",
    gender: "female",
    dateOfBirth: "1986-06-13",
    status: "active",
    systemRole: "manager",
    shiftId: "ca-03",
    workLocation: "Nhà máy Bình Dương",
    managerId: "nv-02",
  },
  {
    fullName: "Chu Văn Lộc",
    departmentId: "pb-05",
    position: "Công nhân vận hành",
    contractType: "full_time",
    startDate: "2021-07-19",
    gender: "male",
    dateOfBirth: "1993-03-15",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-04",
    workLocation: "Nhà máy Bình Dương",
    managerId: "nv-21",
  },
  {
    fullName: "Đinh Thị Hồng Nhung",
    departmentId: "pb-05",
    position: "Nhân viên kiểm định chất lượng",
    contractType: "full_time",
    startDate: "2022-01-24",
    gender: "female",
    dateOfBirth: "1996-11-11",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-03",
    workLocation: "Nhà máy Bình Dương",
    managerId: "nv-21",
  },
  {
    fullName: "Mai Xuân Trường",
    departmentId: "pb-05",
    position: "Kỹ thuật viên bảo trì",
    contractType: "full_time",
    startDate: "2020-05-11",
    gender: "male",
    dateOfBirth: "1991-09-09",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-04",
    workLocation: "Nhà máy Bình Dương",
    managerId: "nv-21",
  },
  {
    fullName: "Hà Thị Ngọc Trâm",
    departmentId: "pb-05",
    position: "Công nhân đóng gói",
    contractType: "seasonal",
    startDate: "2026-04-06",
    gender: "female",
    dateOfBirth: "2000-05-22",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-02",
    workLocation: "Nhà máy Bình Dương",
    managerId: "nv-21",
  },
  {
    fullName: "Lưu Đình Phúc",
    departmentId: "pb-05",
    position: "Công nhân vận hành",
    contractType: "full_time",
    startDate: "2023-11-13",
    gender: "male",
    dateOfBirth: "1998-12-30",
    status: "on_leave",
    systemRole: "employee",
    shiftId: "ca-04",
    workLocation: "Nhà máy Bình Dương",
    managerId: "nv-21",
  },
  {
    fullName: "Nguyễn Thị Thu Hà",
    departmentId: "pb-05",
    position: "Công nhân đóng gói",
    contractType: "full_time",
    startDate: "2024-09-09",
    gender: "female",
    dateOfBirth: "1999-02-06",
    status: "active",
    systemRole: "employee",
    shiftId: "ca-02",
    workLocation: "Nhà máy Bình Dương",
    managerId: "nv-21",
  },
  {
    fullName: "Trần Gia Bảo",
    departmentId: "pb-01",
    position: "Trợ lý giám đốc",
    contractType: "full_time",
    startDate: "2024-01-08",
    gender: "male",
    dateOfBirth: "1997-10-19",
    status: "pending_invite",
    systemRole: "admin",
    shiftId: "ca-01",
    workLocation: "Văn phòng chính",
    managerId: "nv-02",
  },
];

/** Sinh email tu ten tieng Viet: "Nguyễn Minh Anh" -> "minh.anh.nguyen" */
function toEmail(fullName: string, index: number): string {
  const parts = fullName
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .split(/\s+/);
  const surname = parts[0];
  const rest = parts.slice(1).join(".");
  return `${rest}.${surname}${index > 20 ? index : ""}@ngocphat.vn`;
}

/** So dien thoai co dinh theo chi so, khong dung random */
function toPhone(index: number): string {
  const base = 900000000 + index * 1234567;
  const digits = `${base}`.slice(0, 9);
  return `0${digits}`;
}

export const seedEmployees: Employee[] = employeeSeeds.map((seed, index) => {
  const order = index + 1;
  const id = `nv-${`${order}`.padStart(2, "0")}`;
  return {
    id,
    companyId: CURRENT_COMPANY_ID,
    code: `NV${`${order}`.padStart(3, "0")}`,
    fullName: seed.fullName,
    email: toEmail(seed.fullName, order),
    phone: toPhone(order),
    dateOfBirth: seed.dateOfBirth,
    gender: seed.gender,
    avatarUrl: null,
    departmentId: seed.departmentId,
    position: seed.position,
    contractType: seed.contractType,
    startDate: seed.startDate,
    managerId: seed.managerId,
    shiftId: seed.shiftId,
    workLocation: seed.workLocation,
    status: seed.status,
    systemRole: seed.systemRole,
    invitationSent: seed.status !== "pending_invite",
    canViewPayslip: seed.systemRole !== "employee" || order % 3 !== 0,
    canCheckInRemotely:
      seed.workLocation === "Làm việc từ xa" || seed.systemRole !== "employee",
  };
});

/* -------------------------------------------------------------------------- */
/* Cham cong                                                                   */
/* -------------------------------------------------------------------------- */

interface AttendanceSeed {
  employeeIndex: number;
  dayOffset: number;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  location: string;
  needsSupplement?: boolean;
  note?: string;
}

/** 20 ban ghi cham cong gan nhat, dayOffset 0 = hom nay (27/07/2026) */
const attendanceSeeds: AttendanceSeed[] = [
  { employeeIndex: 1, dayOffset: 0, checkIn: "07:52", checkOut: null, status: "on_time", location: "Văn phòng chính" },
  { employeeIndex: 2, dayOffset: 0, checkIn: "07:40", checkOut: null, status: "on_time", location: "Văn phòng chính" },
  { employeeIndex: 3, dayOffset: 0, checkIn: "08:12", checkOut: null, status: "late", location: "Văn phòng chính" },
  { employeeIndex: 4, dayOffset: 0, checkIn: "05:55", checkOut: "14:02", status: "on_time", location: "Kho Long An" },
  { employeeIndex: 5, dayOffset: 0, checkIn: "07:47", checkOut: null, status: "on_time", location: "Văn phòng chính" },
  { employeeIndex: 6, dayOffset: 0, checkIn: "13:58", checkOut: null, status: "on_time", location: "Nhà máy Bình Dương" },
  { employeeIndex: 7, dayOffset: 0, checkIn: "08:21", checkOut: null, status: "late", location: "Văn phòng chính" },
  { employeeIndex: 10, dayOffset: 0, checkIn: "08:35", checkOut: null, status: "late", location: "Chi nhánh Quận 7" },
  { employeeIndex: 12, dayOffset: 0, checkIn: "07:58", checkOut: null, status: "on_time", location: "Văn phòng chính" },
  { employeeIndex: 15, dayOffset: 0, checkIn: "05:58", checkOut: "14:00", status: "on_time", location: "Kho Long An" },
  { employeeIndex: 8, dayOffset: 0, checkIn: "07:56", checkOut: null, status: "on_time", location: "Chi nhánh Quận 7" },
  { employeeIndex: 11, dayOffset: 0, checkIn: "07:45", checkOut: null, status: "on_time", location: "Văn phòng chính" },
  { employeeIndex: 13, dayOffset: 0, checkIn: "07:54", checkOut: null, status: "on_time", location: "Kho Long An" },
  { employeeIndex: 16, dayOffset: 0, checkIn: "05:50", checkOut: "14:05", status: "on_time", location: "Kho Long An" },
  { employeeIndex: 17, dayOffset: 0, checkIn: "05:57", checkOut: "14:01", status: "on_time", location: "Kho Long An" },
  { employeeIndex: 18, dayOffset: 0, checkIn: "13:55", checkOut: null, status: "on_time", location: "Kho Long An" },
  { employeeIndex: 19, dayOffset: 0, checkIn: "05:59", checkOut: "14:03", status: "on_time", location: "Kho Long An" },
  { employeeIndex: 21, dayOffset: 0, checkIn: "13:52", checkOut: null, status: "on_time", location: "Nhà máy Bình Dương" },
  { employeeIndex: 22, dayOffset: 0, checkIn: "21:58", checkOut: null, status: "on_time", location: "Nhà máy Bình Dương" },
  { employeeIndex: 23, dayOffset: 0, checkIn: "13:57", checkOut: null, status: "on_time", location: "Nhà máy Bình Dương" },
  { employeeIndex: 25, dayOffset: 0, checkIn: "05:56", checkOut: "14:00", status: "on_time", location: "Nhà máy Bình Dương" },
  { employeeIndex: 27, dayOffset: 0, checkIn: "05:53", checkOut: "14:02", status: "on_time", location: "Nhà máy Bình Dương" },
  { employeeIndex: 1, dayOffset: -1, checkIn: "07:55", checkOut: "17:34", status: "on_time", location: "Văn phòng chính" },
  { employeeIndex: 1, dayOffset: -2, checkIn: "08:09", checkOut: "17:31", status: "late", location: "Văn phòng chính" },
  { employeeIndex: 1, dayOffset: -3, checkIn: "07:50", checkOut: "16:45", status: "early_leave", location: "Văn phòng chính" },
  { employeeIndex: 1, dayOffset: -4, checkIn: "07:58", checkOut: null, status: "missing_checkout", location: "Văn phòng chính", needsSupplement: true, note: "Quên bấm giờ ra khi đi công tác." },
  { employeeIndex: 1, dayOffset: -5, checkIn: null, checkOut: null, status: "leave_unpaid", location: "—", needsSupplement: true, note: "Nghỉ đột xuất chưa có đơn." },
  { employeeIndex: 3, dayOffset: -1, checkIn: "07:59", checkOut: "17:32", status: "on_time", location: "Văn phòng chính" },
  { employeeIndex: 6, dayOffset: -1, checkIn: "14:05", checkOut: "22:03", status: "late", location: "Nhà máy Bình Dương" },
  { employeeIndex: 22, dayOffset: -1, checkIn: "21:56", checkOut: "06:04", status: "on_time", location: "Nhà máy Bình Dương" },
  { employeeIndex: 24, dayOffset: -1, checkIn: "22:14", checkOut: "06:02", status: "late", location: "Nhà máy Bình Dương" },
  { employeeIndex: 9, dayOffset: -1, checkIn: null, checkOut: null, status: "leave_paid", location: "—" },
  { employeeIndex: 26, dayOffset: -2, checkIn: null, checkOut: null, status: "leave_unpaid", location: "—", needsSupplement: true },
];

function shiftOf(employee: Employee): Shift {
  return seedShifts.find((shift) => shift.id === employee.shiftId) ?? seedShifts[0];
}

function computeWorkedMinutes(
  employee: Employee,
  checkIn: string | null,
  checkOut: string | null,
): number {
  if (!checkIn || !checkOut) return 0;
  const shift = shiftOf(employee);
  const gross = minutesBetween(checkIn, checkOut);
  return Math.max(gross - shift.breakMinutes, 0);
}

function computeLateMinutes(employee: Employee, checkIn: string | null): number {
  if (!checkIn) return 0;
  const shift = shiftOf(employee);
  const diff = minutesBetween(shift.startTime, checkIn);
  // diff lon hon 12 gio nghia la vao som (vong qua ngay), coi nhu khong muon
  if (diff > 720) return 0;
  return Math.max(diff - shift.lateToleranceMinutes, 0);
}

function computeEarlyLeaveMinutes(
  employee: Employee,
  checkOut: string | null,
): number {
  if (!checkOut) return 0;
  const shift = shiftOf(employee);
  const diff = minutesBetween(checkOut, shift.endTime);
  if (diff > 720) return 0;
  return diff;
}

export const seedAttendance: AttendanceRecord[] = attendanceSeeds.map(
  (seed, index) => {
    const employee = seedEmployees[seed.employeeIndex - 1];
    const date = addDays(REFERENCE_DATE, seed.dayOffset);
    return {
      id: `cc-${`${index + 1}`.padStart(3, "0")}`,
      companyId: CURRENT_COMPANY_ID,
      employeeId: employee.id,
      date,
      shiftId: employee.shiftId,
      checkIn: seed.checkIn,
      checkOut: seed.checkOut,
      workedMinutes: computeWorkedMinutes(employee, seed.checkIn, seed.checkOut),
      lateMinutes:
        seed.status === "late" ? computeLateMinutes(employee, seed.checkIn) : 0,
      earlyLeaveMinutes:
        seed.status === "early_leave"
          ? computeEarlyLeaveMinutes(employee, seed.checkOut)
          : 0,
      status: seed.status,
      location: seed.location,
      needsSupplement: seed.needsSupplement ?? false,
      note: seed.note ?? null,
    };
  },
);

/* -------------------------------------------------------------------------- */
/* Yeu cau                                                                     */
/* -------------------------------------------------------------------------- */

export const seedRequests: WorkRequest[] = [
  {
    id: "yc-01",
    companyId: CURRENT_COMPANY_ID,
    employeeId: "nv-01",
    type: "leave",
    status: "pending",
    fromDate: "2026-07-30",
    toDate: "2026-07-31",
    fromTime: null,
    toTime: null,
    reason: "Về quê giải quyết việc gia đình.",
    createdAt: "2026-07-26T09:12:00+07:00",
    reviewerId: null,
    reviewNote: null,
  },
  {
    id: "yc-02",
    companyId: CURRENT_COMPANY_ID,
    employeeId: "nv-01",
    type: "attendance_supplement",
    status: "pending",
    fromDate: "2026-07-23",
    toDate: "2026-07-23",
    fromTime: "07:58",
    toTime: "17:30",
    reason: "Quên bấm giờ ra do đi gặp khách hàng cuối ngày.",
    createdAt: "2026-07-24T08:05:00+07:00",
    reviewerId: null,
    reviewNote: null,
  },
  {
    id: "yc-03",
    companyId: CURRENT_COMPANY_ID,
    employeeId: "nv-06",
    type: "time_adjustment",
    status: "pending",
    fromDate: "2026-07-25",
    toDate: "2026-07-25",
    fromTime: "14:00",
    toTime: "22:00",
    reason: "Máy chấm công lỗi, giờ vào ghi nhận sai 15 phút.",
    createdAt: "2026-07-25T22:40:00+07:00",
    reviewerId: null,
    reviewNote: null,
  },
  {
    id: "yc-04",
    companyId: CURRENT_COMPANY_ID,
    employeeId: "nv-22",
    type: "overtime",
    status: "pending",
    fromDate: "2026-07-28",
    toDate: "2026-07-28",
    fromTime: "06:00",
    toTime: "09:00",
    reason: "Hỗ trợ hoàn thành đơn hàng gấp cho khách.",
    createdAt: "2026-07-26T15:20:00+07:00",
    reviewerId: null,
    reviewNote: null,
  },
  {
    id: "yc-05",
    companyId: CURRENT_COMPANY_ID,
    employeeId: "nv-09",
    type: "leave",
    status: "pending",
    fromDate: "2026-08-03",
    toDate: "2026-08-05",
    fromTime: null,
    toTime: null,
    reason: "Nghỉ phép năm đã đăng ký từ đầu quý.",
    createdAt: "2026-07-27T06:55:00+07:00",
    reviewerId: null,
    reviewNote: null,
  },
  {
    id: "yc-06",
    companyId: CURRENT_COMPANY_ID,
    employeeId: "nv-14",
    type: "attendance_supplement",
    status: "pending",
    fromDate: "2026-07-24",
    toDate: "2026-07-24",
    fromTime: "08:00",
    toTime: "17:30",
    reason: "Chưa được cấp tài khoản nên không chấm công được.",
    createdAt: "2026-07-25T10:02:00+07:00",
    reviewerId: null,
    reviewNote: null,
  },
  {
    id: "yc-07",
    companyId: CURRENT_COMPANY_ID,
    employeeId: "nv-01",
    type: "leave",
    status: "approved",
    fromDate: "2026-07-10",
    toDate: "2026-07-10",
    fromTime: null,
    toTime: null,
    reason: "Khám sức khỏe định kỳ.",
    createdAt: "2026-07-06T11:30:00+07:00",
    reviewerId: "nv-05",
    reviewNote: "Đã duyệt, nhớ bàn giao công việc trước khi nghỉ.",
  },
  {
    id: "yc-08",
    companyId: CURRENT_COMPANY_ID,
    employeeId: "nv-01",
    type: "overtime",
    status: "approved",
    fromDate: "2026-07-17",
    toDate: "2026-07-17",
    fromTime: "17:30",
    toTime: "20:00",
    reason: "Chuẩn bị báo cáo doanh số quý.",
    createdAt: "2026-07-15T14:00:00+07:00",
    reviewerId: "nv-05",
    reviewNote: null,
  },
  {
    id: "yc-09",
    companyId: CURRENT_COMPANY_ID,
    employeeId: "nv-01",
    type: "time_adjustment",
    status: "rejected",
    fromDate: "2026-07-03",
    toDate: "2026-07-03",
    fromTime: "08:00",
    toTime: "17:30",
    reason: "Xin điều chỉnh giờ vào do kẹt xe.",
    createdAt: "2026-07-03T18:20:00+07:00",
    reviewerId: "nv-05",
    reviewNote: "Không đủ căn cứ điều chỉnh, vui lòng đi sớm hơn.",
  },
];

/* ========================================================================== */
/* Doanh nghiep thu hai — de kiem thu luong multi-tenant                       */
/*                                                                            */
/* Bo du lieu nay nho hon va co cau hinh ca khac han cong ty thu nhat, giup    */
/* kiem tra rang moi man hinh deu loc dung theo `companyId`.                   */
/* ========================================================================== */

export const seedDepartments2: Department[] = [
  {
    id: "pb2-01",
    companyId: SECOND_COMPANY_ID,
    name: "Phân xưởng A",
    description: "Dây chuyền ép nhựa và tạo hình sản phẩm.",
    managerId: "nv2-01",
    status: "active",
  },
  {
    id: "pb2-02",
    companyId: SECOND_COMPANY_ID,
    name: "Phân xưởng B",
    description: "Lắp ráp, hoàn thiện và đóng gói thành phẩm.",
    managerId: "nv2-04",
    status: "active",
  },
  {
    id: "pb2-03",
    companyId: SECOND_COMPANY_ID,
    name: "Hành chính nhân sự",
    description: "Tuyển dụng, chấm công và các thủ tục hành chính.",
    managerId: "nv2-07",
    status: "active",
  },
  {
    id: "pb2-04",
    companyId: SECOND_COMPANY_ID,
    name: "Bảo trì thiết bị",
    description: "Bảo dưỡng định kỳ và sửa chữa máy móc dây chuyền.",
    managerId: null,
    status: "inactive",
  },
];

export const seedShifts2: Shift[] = [
  {
    id: "ca2-01",
    companyId: SECOND_COMPANY_ID,
    name: "Ca ngày 12 tiếng",
    code: "N12",
    startTime: "06:00",
    endTime: "18:00",
    breakMinutes: 60,
    lateToleranceMinutes: 10,
    overnight: false,
    workingDays: [1, 3, 5, 6],
    status: "active",
  },
  {
    id: "ca2-02",
    companyId: SECOND_COMPANY_ID,
    name: "Ca đêm 12 tiếng",
    code: "D12",
    startTime: "18:00",
    endTime: "06:00",
    breakMinutes: 60,
    lateToleranceMinutes: 10,
    overnight: true,
    workingDays: [2, 4, 7],
    status: "active",
  },
  {
    id: "ca2-03",
    companyId: SECOND_COMPANY_ID,
    name: "Ca hành chính xưởng",
    code: "HCX",
    startTime: "07:30",
    endTime: "16:30",
    breakMinutes: 60,
    lateToleranceMinutes: 5,
    overnight: false,
    workingDays: [1, 2, 3, 4, 5, 6],
    status: "active",
  },
];

interface Employee2Seed {
  name: string;
  departmentId: string;
  position: string;
  contractType: ContractType;
  status: EmployeeStatus;
  systemRole: SystemRole;
  shiftId: string;
  gender: Gender;
  dateOfBirth: string;
  startDate: string;
}

const employee2Seeds: Employee2Seed[] = [
  {
    name: "Đoàn Minh Trí",
    departmentId: "pb2-01",
    position: "Quản đốc phân xưởng A",
    contractType: "full_time",
    status: "active",
    systemRole: "manager",
    shiftId: "ca2-01",
    gender: "male",
    dateOfBirth: "1985-03-18",
    startDate: "2020-04-06",
  },
  {
    name: "Nguyễn Thị Bích Ngọc",
    departmentId: "pb2-01",
    position: "Công nhân ép nhựa",
    contractType: "full_time",
    status: "active",
    systemRole: "employee",
    shiftId: "ca2-01",
    gender: "female",
    dateOfBirth: "1996-08-24",
    startDate: "2022-02-14",
  },
  {
    name: "Trần Văn Sơn",
    departmentId: "pb2-01",
    position: "Công nhân ép nhựa",
    contractType: "full_time",
    status: "active",
    systemRole: "employee",
    shiftId: "ca2-02",
    gender: "male",
    dateOfBirth: "1994-11-02",
    startDate: "2021-09-20",
  },
  {
    name: "Lê Thị Hồng Vân",
    departmentId: "pb2-02",
    position: "Tổ trưởng lắp ráp",
    contractType: "full_time",
    status: "active",
    systemRole: "manager",
    shiftId: "ca2-01",
    gender: "female",
    dateOfBirth: "1990-05-30",
    startDate: "2019-11-11",
  },
  {
    name: "Phạm Hoàng Long",
    departmentId: "pb2-02",
    position: "Công nhân đóng gói",
    contractType: "seasonal",
    status: "active",
    systemRole: "employee",
    shiftId: "ca2-02",
    gender: "male",
    dateOfBirth: "2001-01-15",
    startDate: "2026-03-02",
  },
  {
    name: "Hồ Thị Kim Chi",
    departmentId: "pb2-02",
    position: "Công nhân đóng gói",
    contractType: "full_time",
    status: "on_leave",
    systemRole: "employee",
    shiftId: "ca2-01",
    gender: "female",
    dateOfBirth: "1998-07-07",
    startDate: "2023-05-08",
  },
  {
    name: "Vương Đức Hiếu",
    departmentId: "pb2-03",
    position: "Trưởng phòng nhân sự",
    contractType: "full_time",
    status: "active",
    systemRole: "admin",
    shiftId: "ca2-03",
    gender: "male",
    dateOfBirth: "1988-12-12",
    startDate: "2020-01-13",
  },
  {
    name: "Bùi Thanh Trúc",
    departmentId: "pb2-03",
    position: "Nhân viên chấm công",
    contractType: "full_time",
    status: "active",
    systemRole: "employee",
    shiftId: "ca2-03",
    gender: "female",
    dateOfBirth: "1999-04-19",
    startDate: "2024-06-03",
  },
  {
    name: "Nguyễn Văn Cường",
    departmentId: "pb2-04",
    position: "Kỹ thuật viên bảo trì",
    contractType: "full_time",
    status: "active",
    systemRole: "employee",
    shiftId: "ca2-02",
    gender: "male",
    dateOfBirth: "1992-09-28",
    startDate: "2021-03-15",
  },
  {
    name: "Trịnh Quốc Đạt",
    departmentId: "pb2-04",
    position: "Kỹ thuật viên bảo trì",
    contractType: "probation",
    status: "pending_invite",
    systemRole: "employee",
    shiftId: "ca2-03",
    gender: "male",
    dateOfBirth: "2000-06-11",
    startDate: "2026-07-01",
  },
  {
    name: "Đặng Thị Lệ Quyên",
    departmentId: "pb2-02",
    position: "Nhân viên kiểm tra chất lượng",
    contractType: "part_time",
    status: "active",
    systemRole: "employee",
    shiftId: "ca2-01",
    gender: "female",
    dateOfBirth: "1997-02-26",
    startDate: "2025-08-18",
  },
  {
    name: "Lý Văn Tuấn",
    departmentId: "pb2-01",
    position: "Công nhân tạo hình",
    contractType: "full_time",
    status: "terminated",
    systemRole: "employee",
    shiftId: "ca2-02",
    gender: "male",
    dateOfBirth: "1993-10-04",
    startDate: "2022-07-25",
  },
];

export const seedEmployees2: Employee[] = employee2Seeds.map((seed, index) => {
  const order = index + 1;
  return {
    id: `nv2-${`${order}`.padStart(2, "0")}`,
    companyId: SECOND_COMPANY_ID,
    code: `BM${`${order}`.padStart(3, "0")}`,
    fullName: seed.name,
    email: toEmail(seed.name, order).replace("@ngocphat.vn", "@binhminh.vn"),
    phone: toPhone(order + 30),
    dateOfBirth: seed.dateOfBirth,
    gender: seed.gender,
    avatarUrl: null,
    departmentId: seed.departmentId,
    position: seed.position,
    contractType: seed.contractType,
    startDate: seed.startDate,
    managerId: null,
    shiftId: seed.shiftId,
    workLocation: "Nhà máy Bình Dương",
    status: seed.status,
    systemRole: seed.systemRole,
    invitationSent: seed.status !== "pending_invite",
    canViewPayslip: seed.systemRole !== "employee",
    canCheckInRemotely: false,
  };
});

interface Attendance2Seed {
  employeeIndex: number;
  dayOffset: number;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
}

const attendance2Seeds: Attendance2Seed[] = [
  { employeeIndex: 1, dayOffset: 0, checkIn: "05:52", checkOut: null, status: "on_time" },
  { employeeIndex: 2, dayOffset: 0, checkIn: "05:58", checkOut: null, status: "on_time" },
  { employeeIndex: 4, dayOffset: 0, checkIn: "06:14", checkOut: null, status: "late" },
  { employeeIndex: 7, dayOffset: 0, checkIn: "07:25", checkOut: null, status: "on_time" },
  { employeeIndex: 8, dayOffset: 0, checkIn: "07:41", checkOut: null, status: "late" },
  { employeeIndex: 11, dayOffset: 0, checkIn: "05:55", checkOut: null, status: "on_time" },
  { employeeIndex: 3, dayOffset: -1, checkIn: "17:56", checkOut: "06:02", status: "on_time" },
  { employeeIndex: 9, dayOffset: -1, checkIn: "18:12", checkOut: "06:05", status: "late" },
  { employeeIndex: 1, dayOffset: -2, checkIn: "05:50", checkOut: "18:04", status: "on_time" },
  { employeeIndex: 6, dayOffset: -2, checkIn: null, checkOut: null, status: "leave_paid" },
];

export const seedAttendance2: AttendanceRecord[] = attendance2Seeds.map(
  (seed, index) => {
    const employee = seedEmployees2[seed.employeeIndex - 1];
    const shift =
      seedShifts2.find((item) => item.id === employee.shiftId) ?? seedShifts2[0];
    const date = addDays(REFERENCE_DATE, seed.dayOffset);
    const worked =
      seed.checkIn && seed.checkOut
        ? Math.max(
            minutesBetween(seed.checkIn, seed.checkOut) - shift.breakMinutes,
            0,
          )
        : 0;

    return {
      id: `cc2-${`${index + 1}`.padStart(3, "0")}`,
      companyId: SECOND_COMPANY_ID,
      employeeId: employee.id,
      date,
      shiftId: shift.id,
      checkIn: seed.checkIn,
      checkOut: seed.checkOut,
      workedMinutes: worked,
      lateMinutes:
        seed.status === "late" && seed.checkIn
          ? Math.max(
              minutesBetween(shift.startTime, seed.checkIn) -
                shift.lateToleranceMinutes,
              0,
            )
          : 0,
      earlyLeaveMinutes: 0,
      status: seed.status,
      location: seed.status === "leave_paid" ? "—" : employee.workLocation,
      needsSupplement: false,
      note: null,
    };
  },
);

export const seedRequests2: WorkRequest[] = [
  {
    id: "yc2-01",
    companyId: SECOND_COMPANY_ID,
    employeeId: "nv2-05",
    type: "overtime",
    status: "pending",
    fromDate: "2026-07-29",
    toDate: "2026-07-29",
    fromTime: "18:00",
    toTime: "21:00",
    reason: "Chạy thêm ca để kịp đơn hàng xuất khẩu cuối tháng.",
    createdAt: "2026-07-26T14:05:00+07:00",
    reviewerId: null,
    reviewNote: null,
  },
  {
    id: "yc2-02",
    companyId: SECOND_COMPANY_ID,
    employeeId: "nv2-06",
    type: "leave",
    status: "pending",
    fromDate: "2026-07-28",
    toDate: "2026-07-30",
    fromTime: null,
    toTime: null,
    reason: "Nghỉ chăm người thân nằm viện.",
    createdAt: "2026-07-25T08:30:00+07:00",
    reviewerId: null,
    reviewNote: null,
  },
  {
    id: "yc2-03",
    companyId: SECOND_COMPANY_ID,
    employeeId: "nv2-09",
    type: "time_adjustment",
    status: "approved",
    fromDate: "2026-07-22",
    toDate: "2026-07-22",
    fromTime: "18:00",
    toTime: "06:00",
    reason: "Máy quét vân tay lỗi đầu ca đêm.",
    createdAt: "2026-07-23T07:10:00+07:00",
    reviewerId: "nv2-07",
    reviewNote: "Đã đối chiếu camera, chấp nhận điều chỉnh.",
  },
];
