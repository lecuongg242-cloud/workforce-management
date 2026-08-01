import { z } from "zod";

/**
 * Schema Zod cho ca lam viec (plan 02-06). Ba phep bien doi phai nam CA
 * trong schema de chi co dung MOT noi dinh nghia (D-12d):
 * - cat/them lai giay o `start_time`/`end_time` (Postgres `time` tra ve
 *   "HH:MM:SS", domain/giao dien dung "HH:mm").
 * - rang buoc mang `working_days` khop dung CHECK cua database (do dai
 *   1..7, moi phan tu nam trong 1..7).
 * - anh xa snake_case (cot Postgres) -> camelCase (domain.ts).
 *
 * `overnight` KHONG BAO GIO duoc tinh lai o day hay bat ky noi nao khac —
 * no la cot sinh (`generated always as (end_time < start_time) stored`
 * o `supabase/migrations/0004_core_entities.sql`), luon doc lai NGUYEN gia
 * tri database tra ve (T-02-06-04, xem <prohibitions> cua 02-06-PLAN.md).
 */

export const shiftStatusSchema = z.enum(["active", "archived"]);

const weekdaySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);

/** Khop CHECK cua database: `working_days <@ array[1..7]` va do dai 1..7. */
const workingDaysSchema = z
  .array(weekdaySchema)
  .min(1, "Phải chọn ít nhất một ngày làm việc.")
  .max(7, "Số ngày làm việc không hợp lệ.");

/** "HH:MM:SS" (Postgres time) -> "HH:mm" (domain/giao dien). */
function cutSeconds(value: string): string {
  return value.slice(0, 5);
}

/**
 * Dong tho tu Supabase (`select(...)` tren `shifts`) — CHI dung o server,
 * NGAY SAU khi doc DB, de chuyen sang hinh dang `Shift` cua domain.ts.
 * KHONG bao gom `employeeCount` — do la gia tri suy dien rieng (dem tu bang
 * `employees`), duoc Route Handler ghep vao SAU buoc nay (giong khuon
 * `loadDepartmentsForCompany` cua 02-05).
 */
export const shiftRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    name: z.string(),
    code: z.string(),
    start_time: z.string().transform(cutSeconds),
    end_time: z.string().transform(cutSeconds),
    break_minutes: z.number(),
    late_tolerance_minutes: z.number(),
    overnight: z.boolean(),
    working_days: workingDaysSchema,
    status: shiftStatusSchema,
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    code: row.code,
    startTime: row.start_time,
    endTime: row.end_time,
    breakMinutes: row.break_minutes,
    lateToleranceMinutes: row.late_tolerance_minutes,
    overnight: row.overnight,
    workingDays: row.working_days,
    status: row.status,
  }));

/**
 * Hinh dang `ShiftWithStats` cuoi cung — dung o CA HAI dau cho hop dong
 * JSON (D-12d): Route Handler parse mang da ghep `employeeCount` truoc khi
 * tra ve, `src/lib/data/shifts.ts` parse lai sau khi nhan qua `fetchJson`.
 */
export const shiftWithStatsSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  code: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  breakMinutes: z.number(),
  lateToleranceMinutes: z.number(),
  overnight: z.boolean(),
  workingDays: workingDaysSchema,
  status: shiftStatusSchema,
  employeeCount: z.number(),
});

export const shiftListResponseSchema = z.array(shiftWithStatsSchema);

/**
 * Khop `ShiftInput` (`Omit<Shift, "id" | "companyId">`) o duong ghi, LOAI
 * BO truong `overnight`: no la cot sinh trong database — dua vao cau lenh
 * insert/update se bi Postgres tu choi (schema khong khai bao truong nay
 * nen Zod tu bo qua neu input con mang theo). `.transform()` tra ve dong
 * snake_case san sang ghi, them lai ":00" cho `start_time`/`end_time` de
 * khop kieu `time` cua Postgres.
 */
export const shiftInputSchema = z
  .object({
    name: z.string(),
    code: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    breakMinutes: z.number(),
    lateToleranceMinutes: z.number(),
    workingDays: workingDaysSchema,
    status: shiftStatusSchema,
  })
  .transform((input) => ({
    name: input.name,
    code: input.code,
    start_time: `${input.startTime}:00`,
    end_time: `${input.endTime}:00`,
    break_minutes: input.breakMinutes,
    late_tolerance_minutes: input.lateToleranceMinutes,
    working_days: input.workingDays,
    status: input.status,
  }));

export type ShiftWithStatsRow = z.infer<typeof shiftWithStatsSchema>;
