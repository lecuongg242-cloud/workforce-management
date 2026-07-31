import { REFERENCE_DATE, REFERENCE_MONTH } from "@/lib/constants";
import { getWeekday, listMonthDates, minutesBetween } from "@/lib/format";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Company,
  Department,
  Employee,
  Shift,
  WorkRequest,
} from "@/lib/types/domain";
import {
  seedAttendance,
  seedAttendance2,
  seedCompanies,
  seedDepartments,
  seedDepartments2,
  seedEmployees,
  seedEmployees2,
  seedRequests,
  seedRequests2,
  seedShifts,
  seedShifts2,
} from "@/lib/mock/seed";

/**
 * "Co so du lieu" trong bo nho cho giai doan chua co backend.
 *
 * O giai doan sau, moi ham trong `service.ts` se doi sang truy van Supabase,
 * con file nay se bi xoa — khong co component nao import truc tiep tu day.
 */
export interface MockDatabase {
  companies: Company[];
  departments: Department[];
  shifts: Shift[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  requests: WorkRequest[];
}

/* -------------------------------------------------------------------------- */
/* Sinh lich su cham cong ca thang cho nhan vien demo                          */
/* -------------------------------------------------------------------------- */

/**
 * Mau cham cong lap lai theo chu ky 8 ngay — co dinh nen khong dung random.
 * Moi phan tu: [gio vao, gio ra, trang thai]
 */
const HISTORY_PATTERN: Array<[string | null, string | null, AttendanceStatus]> = [
  ["07:55", "17:34", "on_time"],
  ["08:11", "17:33", "late"],
  ["07:48", "17:31", "on_time"],
  ["07:59", "16:42", "early_leave"],
  ["07:52", "17:38", "on_time"],
  ["08:07", "17:30", "late"],
  [null, null, "leave_paid"],
  ["07:57", null, "missing_checkout"],
];

function buildMonthlyHistory(
  employee: Employee,
  shift: Shift,
  month: string,
): AttendanceRecord[] {
  const existingDates = new Set(
    seedAttendance
      .filter((record) => record.employeeId === employee.id)
      .map((record) => record.date),
  );

  return listMonthDates(month)
    .filter((date) => date <= REFERENCE_DATE)
    .filter((date) => !existingDates.has(date))
    .map((date, index) => {
      const weekday = getWeekday(date);
      const isWorkingDay = shift.workingDays.includes(weekday);
      const [checkIn, checkOut, status] = isWorkingDay
        ? HISTORY_PATTERN[index % HISTORY_PATTERN.length]
        : ([null, null, "day_off"] as const);

      const workedMinutes =
        checkIn && checkOut
          ? Math.max(minutesBetween(checkIn, checkOut) - shift.breakMinutes, 0)
          : 0;

      const lateMinutes =
        status === "late" && checkIn
          ? Math.max(
              minutesBetween(shift.startTime, checkIn) -
                shift.lateToleranceMinutes,
              0,
            )
          : 0;

      const earlyLeaveMinutes =
        status === "early_leave" && checkOut
          ? minutesBetween(checkOut, shift.endTime)
          : 0;

      return {
        id: `cc-${employee.id}-${date}`,
        companyId: employee.companyId,
        employeeId: employee.id,
        date,
        shiftId: shift.id,
        checkIn,
        checkOut,
        workedMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        status,
        location: status === "day_off" ? "—" : employee.workLocation,
        needsSupplement: status === "missing_checkout",
        note: null,
      } satisfies AttendanceRecord;
    });
}

/* -------------------------------------------------------------------------- */
/* Khoi tao                                                                    */
/* -------------------------------------------------------------------------- */

function createInitialDatabase(): MockDatabase {
  const demoEmployee = seedEmployees[0];
  const demoShift =
    seedShifts.find((shift) => shift.id === demoEmployee.shiftId) ?? seedShifts[0];

  return {
    companies: seedCompanies.map((item) => ({ ...item })),
    departments: [...seedDepartments, ...seedDepartments2].map((item) => ({
      ...item,
    })),
    shifts: [...seedShifts, ...seedShifts2].map((item) => ({ ...item })),
    employees: [...seedEmployees, ...seedEmployees2].map((item) => ({ ...item })),
    attendance: [
      ...seedAttendance.map((item) => ({ ...item })),
      ...seedAttendance2.map((item) => ({ ...item })),
      ...buildMonthlyHistory(demoEmployee, demoShift, REFERENCE_MONTH),
    ],
    requests: [...seedRequests, ...seedRequests2].map((item) => ({ ...item })),
  };
}

let database: MockDatabase = createInitialDatabase();

export function getDb(): MockDatabase {
  return database;
}

/** Dung cho kich ban demo / kiem thu */
export function resetDb(): void {
  database = createInitialDatabase();
}

/** Bo dem tang dan de sinh id moi — khong dung random */
let idCounter = 1000;

export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}
