import { z } from "zod";

import { breakWindowMinutes } from "@/lib/format";

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

/** Migration 0027 — xem `ShiftKind` o `src/lib/types/domain.ts`. */
export const shiftKindSchema = z.enum(["fixed", "hours"]);

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
    kind: shiftKindSchema,
    // `null` o ca linh hoat (migration 0027) — do dai nam o `duration_minutes`.
    start_time: z.string().transform(cutSeconds).nullable(),
    end_time: z.string().transform(cutSeconds).nullable(),
    duration_minutes: z.number().nullable(),
    // Ca tao truoc migration 0025 chua co khung gio nghi -> `null`.
    break_start_time: z.string().transform(cutSeconds).nullable(),
    break_end_time: z.string().transform(cutSeconds).nullable(),
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
    kind: row.kind,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    breakStartTime: row.break_start_time,
    breakEndTime: row.break_end_time,
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
  kind: shiftKindSchema,
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  durationMinutes: z.number().nullable(),
  breakStartTime: z.string().nullable(),
  breakEndTime: z.string().nullable(),
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
/**
 * MOT schema re nhanh theo `kind`, khong phai `z.discriminatedUnion` cua hai
 * schema con: ca hai nhanh deu can `.transform()` sang snake_case, ma
 * `discriminatedUnion` cua Zod 3 chi nhan `ZodObject` thuan — mot `ZodEffects`
 * (thu ma `.refine()`/`.transform()` tra ve) lam no nem NGAY LUC DINH NGHIA
 * schema. `z.union` thi nhan, nhung khi that bai no gom loi cua CA HAI nhanh
 * vao mot `invalid_union`, va cau tieng Viet cua nhanh dung bi chon lan giua
 * cac cau cua nhanh sai.
 *
 * Nen: mot object voi cac truong rieng cua tung loai de `.optional()`, va
 * `superRefine` bat dung nhung gi loai ca do doi hoi.
 */
export const shiftInputSchema = z
  .object({
    name: z.string(),
    code: z.string(),
    kind: shiftKindSchema,
    startTime: z.string().nullable().optional(),
    endTime: z.string().nullable().optional(),
    durationMinutes: z.number().nullable().optional(),
    breakStartTime: z.string().nullable().optional(),
    breakEndTime: z.string().nullable().optional(),
    lateToleranceMinutes: z.number().optional(),
    workingDays: workingDaysSchema,
    status: shiftStatusSchema,
  })
  .superRefine((input, ctx) => {
    const invalid = (message: string, path: string): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
    };

    if (input.kind === "hours") {
      // Ca linh hoat: do dai la thu DUY NHAT phai co.
      if (typeof input.durationMinutes !== "number") {
        invalid("Vui lòng nhập số giờ làm một ngày.", "durationMinutes");
        return;
      }
      if (!Number.isInteger(input.durationMinutes)) {
        invalid(
          "Số giờ làm một ngày phải quy ra số phút nguyên.",
          "durationMinutes",
        );
      }
      if (input.durationMinutes <= 0) {
        invalid("Số giờ làm một ngày phải lớn hơn 0.", "durationMinutes");
      }
      if (input.durationMinutes > 1440) {
        invalid(
          "Một ngày làm việc không thể dài hơn 24 giờ.",
          "durationMinutes",
        );
      }
      return;
    }

    if (!input.startTime || !input.endTime) {
      invalid("Vui lòng nhập giờ bắt đầu và giờ kết thúc ca.", "endTime");
      return;
    }
    if (input.startTime === input.endTime) {
      invalid(
        "Giờ bắt đầu và giờ kết thúc ca không được trùng nhau.",
        "endTime",
      );
    }
    // Hai cot khung gio di cung nhau — khop rang buoc
    // `shifts_break_window_both_or_neither` cua database, va chan o day de loi
    // doc duoc bang tieng Viet thay vi mot thong diep cua Postgres.
    const breakStart = input.breakStartTime ?? null;
    const breakEnd = input.breakEndTime ?? null;
    if ((breakStart === null) !== (breakEnd === null)) {
      invalid(
        "Khung giờ nghỉ phải có cả giờ bắt đầu và giờ kết thúc.",
        "breakEndTime",
      );
    }
    if (breakStart !== null && breakStart === breakEnd) {
      invalid(
        "Giờ bắt đầu nghỉ và giờ kết thúc nghỉ không được trùng nhau.",
        "breakEndTime",
      );
    }
    if (typeof input.lateToleranceMinutes !== "number") {
      invalid(
        "Vui lòng nhập biên độ cho phép đi muộn.",
        "lateToleranceMinutes",
      );
    }
  })
  .transform((input) => {
    // Ca linh hoat: nam cot con lai KHONG nhan gia tri tu noi goi, chung la
    // hang so cua hinh dang nay. `shifts_shape_check` cua database bat dung nam
    // dieu do — de noi goi tu dat mot trong nam se sinh ra mot loi rang buoc
    // Postgres tho o giao dien thay vi mot cau tieng Viet, nen chung duoc dong
    // cung tai day.
    if (input.kind === "hours") {
      return {
        name: input.name,
        code: input.code,
        kind: "hours" as const,
        start_time: null,
        end_time: null,
        duration_minutes: input.durationMinutes as number,
        break_start_time: null,
        break_end_time: null,
        break_minutes: 0,
        late_tolerance_minutes: 0,
        working_days: input.workingDays,
        status: input.status,
      };
    }

    const breakStart = input.breakStartTime ?? null;
    const breakEnd = input.breakEndTime ?? null;
    return {
      name: input.name,
      code: input.code,
      kind: "fixed" as const,
      start_time: `${input.startTime as string}:00`,
      end_time: `${input.endTime as string}:00`,
      duration_minutes: null,
      break_start_time: breakStart === null ? null : `${breakStart}:00`,
      break_end_time: breakEnd === null ? null : `${breakEnd}:00`,
      // DAY LA NOI DUY NHAT tinh `break_minutes` (migration 0025). Khong nhan
      // no tu noi goi: hai gia tri lech nhau thi phep tinh cong se tru mot
      // khoang khong ai nhin thay o giao dien.
      break_minutes: breakWindowMinutes(breakStart, breakEnd),
      late_tolerance_minutes: input.lateToleranceMinutes ?? 0,
      working_days: input.workingDays,
      status: input.status,
    };
  });

export type ShiftWithStatsRow = z.infer<typeof shiftWithStatsSchema>;
