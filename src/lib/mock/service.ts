import { DEFAULT_PAGE_SIZE, REFERENCE_DATE } from "@/lib/constants";
import {
  addDays,
  formatDayMonth,
  getWeekday,
  minutesBetween,
  normalizeText,
  toIsoMonth,
} from "@/lib/format";
import { getDb, nextId } from "@/lib/mock/db";
import type {
  AttendanceChartPoint,
  AttendanceQuery,
  AttendanceRecord,
  Company,
  CompanyInput,
  DashboardSummary,
  Department,
  DepartmentInput,
  Employee,
  EmployeeInput,
  EmployeeQuery,
  MonthlySummary,
  Paginated,
  PendingRequestSummary,
  RequestQuery,
  RequestType,
  Shift,
  ShiftInput,
  TodayActivityItem,
  WeekdayNumber,
  WorkRequest,
  WorkRequestInput,
} from "@/lib/types/domain";

/**
 * Lop dich vu gia lap.
 *
 * Moi ham deu bat dong bo va co do tre nhu goi mang that, nen giai doan sau
 * chi can thay phan than ham bang truy van Supabase ma khong phai sua UI.
 * Vi du: `listEmployees` -> `supabase.from("employees").select(...)`.
 */

/** Bat co nay de kiem thu giao dien bao loi */
export const mockConfig = {
  simulateError: false,
  latencyMs: 420,
};

function delay(ms: number = mockConfig.latencyMs): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function guard(): Promise<void> {
  await delay();
  if (mockConfig.simulateError) {
    throw new Error("Không thể kết nối tới máy chủ. Vui lòng thử lại.");
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/* -------------------------------------------------------------------------- */
/* Doanh nghiep                                                                */
/* -------------------------------------------------------------------------- */

export async function listCompanies(): Promise<Company[]> {
  await guard();
  const db = getDb();
  // Dem lai theo du lieu that, dung cung cach tinh voi KPI "Tong nhan vien"
  // va danh sach nhan vien, de ba noi luon hien thi cung mot con so.
  return clone(
    db.companies.map((company) => ({
      ...company,
      employeeCount: db.employees.filter(
        (employee) => employee.companyId === company.id,
      ).length,
    })),
  );
}

export async function getCompany(id: string): Promise<Company | null> {
  await guard();
  return clone(getDb().companies.find((item) => item.id === id) ?? null);
}

export async function createCompany(input: CompanyInput): Promise<Company> {
  await guard();
  const company: Company = {
    ...input,
    id: nextId("cty"),
    role: "owner",
    employeeCount: 0,
    lastAccessedAt: `${REFERENCE_DATE}T08:00:00+07:00`,
    accent: "indigo",
  };
  getDb().companies.push(company);
  return clone(company);
}

/* -------------------------------------------------------------------------- */
/* Phong ban                                                                   */
/* -------------------------------------------------------------------------- */

export interface DepartmentWithStats extends Department {
  employeeCount: number;
  managerName: string | null;
}

export async function listDepartments(
  companyId: string,
): Promise<DepartmentWithStats[]> {
  await guard();
  const db = getDb();
  return db.departments
    .filter((department) => department.companyId === companyId)
    .map((department) => ({
      ...department,
      employeeCount: db.employees.filter(
        (employee) =>
          employee.departmentId === department.id &&
          employee.status !== "terminated",
      ).length,
      managerName:
        db.employees.find((employee) => employee.id === department.managerId)
          ?.fullName ?? null,
    }));
}

export async function createDepartment(
  companyId: string,
  input: DepartmentInput,
): Promise<Department> {
  await guard();
  const department: Department = { ...input, id: nextId("pb"), companyId };
  getDb().departments.push(department);
  return clone(department);
}

export async function updateDepartment(
  id: string,
  patch: Partial<DepartmentInput>,
): Promise<Department> {
  await guard();
  const db = getDb();
  const index = db.departments.findIndex((item) => item.id === id);
  if (index === -1) throw new Error("Không tìm thấy phòng ban.");
  db.departments[index] = { ...db.departments[index], ...patch };
  return clone(db.departments[index]);
}

export async function deleteDepartment(id: string): Promise<void> {
  await guard();
  const db = getDb();
  db.departments = db.departments.filter((item) => item.id !== id);
}

/* -------------------------------------------------------------------------- */
/* Ca lam viec                                                                 */
/* -------------------------------------------------------------------------- */

export interface ShiftWithStats extends Shift {
  employeeCount: number;
}

export async function listShifts(companyId: string): Promise<ShiftWithStats[]> {
  await guard();
  const db = getDb();
  return db.shifts
    .filter((shift) => shift.companyId === companyId)
    .map((shift) => ({
      ...shift,
      employeeCount: db.employees.filter(
        (employee) =>
          employee.shiftId === shift.id && employee.status !== "terminated",
      ).length,
    }));
}

export async function createShift(
  companyId: string,
  input: ShiftInput,
): Promise<Shift> {
  await guard();
  const shift: Shift = { ...input, id: nextId("ca"), companyId };
  getDb().shifts.push(shift);
  return clone(shift);
}

export async function updateShift(
  id: string,
  patch: Partial<ShiftInput>,
): Promise<Shift> {
  await guard();
  const db = getDb();
  const index = db.shifts.findIndex((item) => item.id === id);
  if (index === -1) throw new Error("Không tìm thấy ca làm việc.");
  db.shifts[index] = { ...db.shifts[index], ...patch };
  return clone(db.shifts[index]);
}

export async function duplicateShift(id: string): Promise<Shift> {
  await guard();
  const db = getDb();
  const source = db.shifts.find((item) => item.id === id);
  if (!source) throw new Error("Không tìm thấy ca làm việc.");
  const copy: Shift = {
    ...source,
    id: nextId("ca"),
    name: `${source.name} (bản sao)`,
    code: `${source.code}2`,
  };
  db.shifts.push(copy);
  return clone(copy);
}

/* -------------------------------------------------------------------------- */
/* Nhan vien                                                                   */
/* -------------------------------------------------------------------------- */

export async function listEmployees(
  query: EmployeeQuery,
): Promise<Paginated<Employee>> {
  await guard();
  const db = getDb();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const keyword = query.search ? normalizeText(query.search) : "";

  const filtered = db.employees.filter((employee) => {
    if (employee.companyId !== query.companyId) return false;
    if (
      query.departmentId &&
      query.departmentId !== "all" &&
      employee.departmentId !== query.departmentId
    ) {
      return false;
    }
    if (query.status && query.status !== "all" && employee.status !== query.status) {
      return false;
    }
    if (
      query.contractType &&
      query.contractType !== "all" &&
      employee.contractType !== query.contractType
    ) {
      return false;
    }
    if (keyword) {
      const haystack = normalizeText(
        `${employee.fullName} ${employee.code} ${employee.phone} ${employee.email}`,
      );
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: clone(filtered.slice(start, start + pageSize)),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/** Danh sach rut gon dung cho o chon "quan ly truc tiep", tim kiem nhanh... */
export async function listAllEmployees(companyId: string): Promise<Employee[]> {
  await guard();
  return clone(
    getDb().employees.filter((employee) => employee.companyId === companyId),
  );
}

export async function getEmployee(id: string): Promise<Employee | null> {
  await guard();
  return clone(getDb().employees.find((employee) => employee.id === id) ?? null);
}

export async function createEmployee(
  companyId: string,
  input: EmployeeInput,
): Promise<Employee> {
  await guard();
  const db = getDb();
  const duplicated = db.employees.some(
    (employee) =>
      employee.companyId === companyId &&
      employee.code.toLowerCase() === input.code.toLowerCase(),
  );
  if (duplicated) {
    throw new Error(`Mã nhân viên ${input.code} đã tồn tại.`);
  }
  const employee: Employee = { ...input, id: nextId("nv"), companyId };
  db.employees.unshift(employee);

  const company = db.companies.find((item) => item.id === companyId);
  if (company) company.employeeCount += 1;

  return clone(employee);
}

export async function updateEmployee(
  id: string,
  patch: Partial<EmployeeInput>,
): Promise<Employee> {
  await guard();
  const db = getDb();
  const index = db.employees.findIndex((employee) => employee.id === id);
  if (index === -1) throw new Error("Không tìm thấy nhân viên.");
  db.employees[index] = { ...db.employees[index], ...patch };
  return clone(db.employees[index]);
}

export async function bulkMoveDepartment(
  ids: string[],
  departmentId: string,
): Promise<number> {
  await guard();
  const db = getDb();
  let moved = 0;
  db.employees = db.employees.map((employee) => {
    if (!ids.includes(employee.id)) return employee;
    moved += 1;
    return { ...employee, departmentId };
  });
  return moved;
}

/* -------------------------------------------------------------------------- */
/* Cham cong                                                                   */
/* -------------------------------------------------------------------------- */

export async function listAttendance(
  query: AttendanceQuery,
): Promise<AttendanceRecord[]> {
  await guard();
  const db = getDb();
  return clone(
    db.attendance
      .filter((record) => record.companyId === query.companyId)
      .filter((record) =>
        query.employeeId ? record.employeeId === query.employeeId : true,
      )
      .filter((record) =>
        query.month ? toIsoMonth(record.date) === query.month : true,
      )
      .filter((record) => (query.date ? record.date === query.date : true))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
  );
}

export async function getMonthlySummary(
  companyId: string,
  employeeId: string,
  month: string,
): Promise<MonthlySummary> {
  await guard();
  const records = getDb().attendance.filter(
    (record) =>
      record.companyId === companyId &&
      record.employeeId === employeeId &&
      toIsoMonth(record.date) === month,
  );

  return {
    month,
    workedDays: records.filter((record) => record.workedMinutes > 0).length,
    totalMinutes: records.reduce((sum, record) => sum + record.workedMinutes, 0),
    lateCount: records.filter((record) => record.status === "late").length,
    leaveDays: records.filter(
      (record) => record.status === "leave_paid" || record.status === "leave_unpaid",
    ).length,
  };
}

/** Ghi nhan gio vao ca cho man hinh nhan vien */
export async function checkIn(
  companyId: string,
  employeeId: string,
  date: string,
  time: string,
): Promise<AttendanceRecord> {
  await guard();
  const db = getDb();
  const employee = db.employees.find((item) => item.id === employeeId);
  if (!employee) throw new Error("Không tìm thấy nhân viên.");
  const shift = db.shifts.find((item) => item.id === employee.shiftId);
  if (!shift) throw new Error("Nhân viên chưa được gán ca làm việc.");

  const lateMinutes = Math.max(
    minutesBetween(shift.startTime, time) - shift.lateToleranceMinutes,
    0,
  );

  const record: AttendanceRecord = {
    id: nextId("cc"),
    companyId,
    employeeId,
    date,
    shiftId: shift.id,
    checkIn: time,
    checkOut: null,
    workedMinutes: 0,
    lateMinutes: lateMinutes > 720 ? 0 : lateMinutes,
    earlyLeaveMinutes: 0,
    status: lateMinutes > 0 && lateMinutes <= 720 ? "late" : "on_time",
    location: employee.workLocation,
    needsSupplement: false,
    note: null,
  };

  db.attendance = [
    record,
    ...db.attendance.filter(
      (item) => !(item.employeeId === employeeId && item.date === date),
    ),
  ];
  return clone(record);
}

/** Ghi nhan gio tan ca */
export async function checkOut(
  recordId: string,
  time: string,
): Promise<AttendanceRecord> {
  await guard();
  const db = getDb();
  const index = db.attendance.findIndex((item) => item.id === recordId);
  if (index === -1) throw new Error("Không tìm thấy bản ghi chấm công.");

  const record = db.attendance[index];
  const shift = db.shifts.find((item) => item.id === record.shiftId);
  const breakMinutes = shift?.breakMinutes ?? 0;
  const earlyLeave = shift ? minutesBetween(time, shift.endTime) : 0;

  const updated: AttendanceRecord = {
    ...record,
    checkOut: time,
    workedMinutes: record.checkIn
      ? Math.max(minutesBetween(record.checkIn, time) - breakMinutes, 0)
      : 0,
    earlyLeaveMinutes: earlyLeave > 720 ? 0 : earlyLeave,
    status:
      record.status === "late"
        ? "late"
        : earlyLeave > 0 && earlyLeave <= 720
          ? "early_leave"
          : "on_time",
  };

  db.attendance[index] = updated;
  return clone(updated);
}

/* -------------------------------------------------------------------------- */
/* Yeu cau                                                                     */
/* -------------------------------------------------------------------------- */

export async function listRequests(query: RequestQuery): Promise<WorkRequest[]> {
  await guard();
  return clone(
    getDb()
      .requests.filter((request) => request.companyId === query.companyId)
      .filter((request) =>
        query.employeeId ? request.employeeId === query.employeeId : true,
      )
      .filter((request) =>
        query.status && query.status !== "all"
          ? request.status === query.status
          : true,
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  );
}

export async function createRequest(
  companyId: string,
  employeeId: string,
  input: WorkRequestInput,
): Promise<WorkRequest> {
  await guard();
  const request: WorkRequest = {
    ...input,
    id: nextId("yc"),
    companyId,
    employeeId,
    status: "pending",
    createdAt: `${REFERENCE_DATE}T09:00:00+07:00`,
    reviewerId: null,
    reviewNote: null,
  };
  getDb().requests.unshift(request);
  return clone(request);
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

function countByStatusOnDate(
  records: AttendanceRecord[],
  date: string,
): { present: number; late: number; leave: number } {
  const ofDay = records.filter((record) => record.date === date);
  return {
    present: ofDay.filter((record) => record.checkIn !== null).length,
    late: ofDay.filter((record) => record.status === "late").length,
    leave: ofDay.filter(
      (record) =>
        record.status === "leave_paid" || record.status === "leave_unpaid",
    ).length,
  };
}

/**
 * Bo so lieu 7 ngay cua bieu do — tinh theo cong thuc co dinh dua tren so
 * nhan vien dang hoat dong nen khong bao gio nhay giua cac lan render.
 */
const CHART_PRESENT_OFFSET = [-3, -1, -2, 0, -4, -6, -5];
const CHART_LATE_VALUES = [2, 4, 3, 3, 5, 2, 3];

export async function getDashboardSummary(
  companyId: string,
  date: string,
): Promise<DashboardSummary> {
  await guard();
  const db = getDb();

  const employees = db.employees.filter(
    (employee) => employee.companyId === companyId,
  );
  const activeEmployees = employees.filter(
    (employee) => employee.status !== "terminated",
  );
  const attendance = db.attendance.filter(
    (record) => record.companyId === companyId,
  );

  const today = countByStatusOnDate(attendance, date);
  const yesterday = countByStatusOnDate(attendance, addDays(date, -1));

  const onLeaveToday = employees.filter(
    (employee) => employee.status === "on_leave",
  ).length;

  const headcount = employees.length;

  const chart: AttendanceChartPoint[] = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(date, index - 6);
    const weekday = getWeekday(day);
    const isSunday = weekday === 7;
    const isToday = day === date;

    // Ngay hom nay lay so lieu that; cac ngay truoc dung so lieu mau co dinh
    const present = isToday
      ? today.present
      : isSunday
        ? 0
        : Math.max(headcount + CHART_PRESENT_OFFSET[index] - 4, 0);
    const late = isToday ? today.late : isSunday ? 0 : CHART_LATE_VALUES[index];
    const absent = isSunday ? 0 : Math.max(headcount - present, 0);

    return {
      date: day,
      label: `${weekdayShort(weekday)} ${formatDayMonth(day)}`,
      present,
      late,
      absent,
    };
  });

  const departmentName = (departmentId: string): string =>
    db.departments.find((item) => item.id === departmentId)?.name ?? "—";

  const todayRecords = attendance.filter((record) => record.date === date);

  const todayActivity: TodayActivityItem[] = todayRecords
    .filter((record) => record.checkIn !== null)
    .map((record) => {
      const employee = employees.find((item) => item.id === record.employeeId);
      return {
        employeeId: record.employeeId,
        employeeName: employee?.fullName ?? "—",
        departmentName: employee ? departmentName(employee.departmentId) : "—",
        avatarUrl: employee?.avatarUrl ?? null,
        checkIn: record.checkIn,
        status: record.status,
        location: record.location,
      };
    })
    .sort((a, b) => (a.checkIn ?? "").localeCompare(b.checkIn ?? ""));

  const checkedInIds = new Set(todayActivity.map((item) => item.employeeId));

  // Nguoi "chua cham cong": van con lam viec, khong nghi phep va chua co ban ghi
  const notCheckedIn = activeEmployees
    .filter((employee) => employee.status !== "on_leave")
    .filter((employee) => !checkedInIds.has(employee.id))
    .slice(0, 6)
    .map((employee) => ({
      employeeId: employee.id,
      employeeName: employee.fullName,
      departmentName: departmentName(employee.departmentId),
      avatarUrl: employee.avatarUrl,
      phone: employee.phone,
      shiftName:
        db.shifts.find((shift) => shift.id === employee.shiftId)?.name ?? "—",
    }));

  const pendingTypes: RequestType[] = [
    "leave",
    "attendance_supplement",
    "time_adjustment",
    "overtime",
  ];

  const pendingRequests: PendingRequestSummary[] = pendingTypes.map((type) => ({
    type,
    count: db.requests.filter(
      (request) =>
        request.companyId === companyId &&
        request.status === "pending" &&
        request.type === type,
    ).length,
  }));

  return {
    date,
    // Tong nhan su cua doanh nghiep, ke ca nguoi chua kich hoat tai khoan
    totalEmployees: {
      value: headcount,
      delta: 0,
    },
    checkedIn: {
      value: today.present,
      delta: today.present - yesterday.present,
    },
    late: { value: today.late, delta: today.late - yesterday.late },
    onLeave: { value: onLeaveToday, delta: onLeaveToday - yesterday.leave },
    chart,
    todayActivity,
    pendingRequests,
    notCheckedIn,
  };
}

function weekdayShort(weekday: WeekdayNumber): string {
  const labels: Record<WeekdayNumber, string> = {
    1: "T2",
    2: "T3",
    3: "T4",
    4: "T5",
    5: "T6",
    6: "T7",
    7: "CN",
  };
  return labels[weekday];
}
