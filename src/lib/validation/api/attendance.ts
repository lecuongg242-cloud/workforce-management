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
  /* ---- SET-04 (plan 04-05): tang ca quy doi theo quy tac cua doanh nghiep --
   * Bon truong duoi day TUY CHON de moi noi dang doc schema nay khong vo khi
   * chua co du lieu — nhung o duong tra ve cua Route Handler chung LUON co
   * mat. `convertedOvertimeHours` bang `null` nghia la THIEU HE SO (D-26),
   * KHONG phai "khong co gio tang ca nao" — hai thu do phai phan biet duoc o
   * giao dien.
   */
  overtimeMinutes: z.number().optional(),
  overtimeNightMinutes: z.number().optional(),
  convertedOvertimeHours: z.number().nullable().optional(),
  missingMultiplierKeys: z
    .array(z.enum(["weekday", "weekend", "holiday", "night"]))
    .optional(),
  /* ---- D-36/D-39 (plan 05-2-02): so lieu theo CHE DO TINH CONG ------------
   * `creditedDays` KHONG phai `z.number().int()`: o che do `daily_hours` no
   * la mot so thap phan (lam 6/10 tieng ra 0,6 — D-39). Mot rang buoc `int()`
   * o day se lam ca phan hoi hong doi voi doanh nghiep dung che do do.
   * `null` nghia la THIEU MAU SO, khong phai "khong lam ngay nao".
   */
  workMode: z.enum(["daily_hours", "shift", "shift_hourly"]).optional(),
  creditedDays: z.number().nullable().optional(),
  regularMinutes: z.number().nullable().optional(),
  hourDeltaMinutes: z.number().optional(),
  missingWorkModeInputs: z.array(z.enum(["standard_hours_per_day"])).optional(),
});

/** Mot ngay cong kem phan loai theo quy tac cua doanh nghiep (SET-04). */
export const attendanceDayClassificationSchema = z.object({
  date: z.string(),
  dayType: z.enum(["weekday", "weekend", "holiday"]),
  workedMinutes: z.number(),
  nightMinutes: z.number(),
  overtimeMinutes: z.number(),
  overtimeNightMinutes: z.number(),
  convertedOvertimeHours: z.number().nullable(),
  missingMultiplierKeys: z.array(
    z.enum(["weekday", "weekend", "holiday", "night"]),
  ),
  /* Phan tang ca cua TUNG LUOT, cung thu tu voi cac luot cua ngay do.
   * `.default([])` de moi noi dang doc schema nay khong vo khi phan hoi den
   * tu mot phien ban cu — o duong tra ve hien tai no luon co mat. */
  punches: z
    .array(
      z.object({
        regularMinutes: z.number(),
        overtimeMinutes: z.number(),
        overtimeNightMinutes: z.number(),
        convertedOvertimeHours: z.number().nullable(),
      }),
    )
    .default([]),
});

export const attendanceClassificationListResponseSchema = z.array(
  attendanceDayClassificationSchema,
);
