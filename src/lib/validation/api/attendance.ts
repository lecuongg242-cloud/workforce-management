import { z } from "zod";

import { DEFAULT_TIMEZONE } from "@/lib/constants";

/**
 * Schema Zod cho cham cong (plan 02-08). Ba phep bien doi nam trong schema
 * (D-12d, dung khuon `shiftRowSchema`/`employeeRowSchema`):
 * - `work_date` (kieu `date` cua Postgres, da la chuoi "YYYY-MM-DD" qua
 *   PostgREST) -> `date`, khong can bien doi them.
 * - `check_in_at`/`check_out_at` (kieu `timestamptz`) -> `checkIn`/`checkOut`
 *   dang "HH:mm" THEO MUI GIO VIET NAM, `null` giu nguyen `null`.
 * - snake_case -> camelCase.
 */

export const attendanceStatusSchema = z.enum([
  "on_time",
  "late",
  "early_leave",
  "missing_checkout",
  "leave_paid",
  "leave_unpaid",
  "day_off",
]);

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DEFAULT_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * "2026-08-01T01:05:00+00:00" (timestamptz tho tu Postgres) -> "08:05" (gio
 * Viet Nam). `null` giu nguyen `null` — dung cho CA HAI dau (Route Handler
 * chuyen ngay sau khi doc DB o `attendanceRecordSchema`, va `dashboard.ts`
 * dung lai CHINH ham nay cho `todayActivity[].checkIn`, tranh viet lai phep
 * doi mui gio o hai noi — D-19 canh bao dung mot quy uoc mui gio thu hai).
 */
export function toVnTime(value: string | null): string | null {
  if (value === null) return null;
  return timeFormatter.format(new Date(value));
}

/**
 * Dong tho tu Supabase (`select(...)` tren `attendance_records`) — CHI dung
 * o server, ngay sau khi doc DB.
 */
export const attendanceRecordSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    employee_id: z.string(),
    work_date: z.string(),
    shift_id: z.string(),
    check_in_at: z.string().nullable(),
    check_out_at: z.string().nullable(),
    worked_minutes: z.number(),
    late_minutes: z.number(),
    early_leave_minutes: z.number(),
    status: attendanceStatusSchema,
    location: z.string(),
    needs_supplement: z.boolean(),
    note: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    date: row.work_date,
    shiftId: row.shift_id,
    checkIn: toVnTime(row.check_in_at),
    checkOut: toVnTime(row.check_out_at),
    workedMinutes: row.worked_minutes,
    lateMinutes: row.late_minutes,
    earlyLeaveMinutes: row.early_leave_minutes,
    status: row.status,
    location: row.location,
    needsSupplement: row.needs_supplement,
    note: row.note,
  }));

/**
 * Hinh dang `AttendanceRecord` cua domain.ts — dung o CA HAI dau cho hop
 * dong JSON cuoi cung (D-12d): Route Handler parse mang da-anh-xa truoc khi
 * tra ve, `src/lib/data/attendance.ts` parse lai sau khi nhan qua `fetchJson`.
 */
export const attendanceRecordPlainSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  employeeId: z.string(),
  date: z.string(),
  shiftId: z.string(),
  checkIn: z.string().nullable(),
  checkOut: z.string().nullable(),
  workedMinutes: z.number(),
  lateMinutes: z.number(),
  earlyLeaveMinutes: z.number(),
  status: attendanceStatusSchema,
  location: z.string(),
  needsSupplement: z.boolean(),
  note: z.string().nullable(),
});

export const attendanceListResponseSchema = z.array(attendanceRecordPlainSchema);

/**
 * Tham so truy van cua `GET /api/attendance` — KHONG khai bat ky truong
 * dinh danh doanh nghiep nao (D-12b), pham vi luon den tu `getSessionContext()`.
 */
export const attendanceQuerySchema = z.object({
  employeeId: z.string().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Định dạng tháng không hợp lệ.")
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày không hợp lệ.")
    .optional(),
});

/** Tham so truy van cua `GET /api/attendance/summary`. */
export const attendanceSummaryQuerySchema = z.object({
  employeeId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Định dạng tháng không hợp lệ."),
});

/** Khop `MonthlySummary` cua domain.ts. */
export const monthlySummarySchema = z.object({
  month: z.string(),
  workedDays: z.number(),
  totalMinutes: z.number(),
  lateCount: z.number(),
  leaveDays: z.number(),
});
