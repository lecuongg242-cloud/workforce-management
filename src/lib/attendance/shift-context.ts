import type { ShiftRuleInfo } from "@/lib/attendance/classification-context";
import { shiftBreakInfoById, type ShiftBreakInfo } from "@/lib/attendance/day";
import { shiftScheduledMinutes } from "@/lib/shifts/schedule";
import type { ShiftKind } from "@/lib/types/domain";

/**
 * Doc cac dong `shifts` tho ra HAI bang tra ma moi phep tinh cong can:
 * `breaks` (gio nghi + do dai tron ca, cho `groupAttendanceByDay`) va
 * `shiftRules` (ngay lam viec + do dai ca da tru gio nghi, cho `classifyDay` va
 * `resolveDayCredit`).
 *
 * VI SAO MODULE NAY TON TAI: cung mot doan nay tung nam NGUYEN VAN o ba noi —
 * `month-context.ts`, `GET /api/attendance/classification` va
 * `GET /api/requests/overtime-usage`. Migration 0027 them mot loai ca thu hai;
 * neu chi mot trong ba noi quen doi thi ca linh hoat o duong do se co
 * `scheduledMinutes = 0`, va do CHINH LA cai bay D-36a ma `work-mode.ts` mo ta:
 * toan bo gio lam thanh tang ca, luong gap ruoi, khong mot dong loi nao. Ba ban
 * sao cua mot phep tinh la ba co hoi de quen.
 *
 * Module THUAN: khong dung client co so du lieu — noi goi tu doc, module nay
 * chi bien doi.
 */

/** Dung o MOI truy van `shifts` phuc vu tinh cong — cung mot danh sach cot. */
export const SHIFT_CONTEXT_COLUMNS =
  "id, kind, break_minutes, start_time, end_time, duration_minutes, working_days";

/** Dong tho tra ve tu `select(SHIFT_CONTEXT_COLUMNS)`. */
export interface RawShiftContextRow {
  id: string;
  kind: ShiftKind;
  break_minutes: number;
  /** "HH:mm:ss" — `null` o ca linh hoat (migration 0027) */
  start_time: string | null;
  end_time: string | null;
  /** Phut — `null` o ca `fixed` */
  duration_minutes: number | null;
  working_days: number[];
}

export interface ShiftContext {
  breaks: Record<string, ShiftBreakInfo>;
  shiftRules: Map<string, ShiftRuleInfo>;
}

export function buildShiftContext(rows: RawShiftContextRow[]): ShiftContext {
  const shifts = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    breakMinutes: row.break_minutes,
    // `time` cua Postgres ve dang "HH:mm:ss" — cat con "HH:mm" cho khop quy uoc
    // gio cua tang ung dung.
    startTime: row.start_time?.slice(0, 5) ?? null,
    endTime: row.end_time?.slice(0, 5) ?? null,
    durationMinutes: row.duration_minutes,
  }));

  const breaks = shiftBreakInfoById(shifts);

  const shiftRules = new Map<string, ShiftRuleInfo>(
    shifts.map((shift, index) => [
      shift.id,
      {
        workingDays: rows[index].working_days as ShiftRuleInfo["workingDays"],
        scheduledMinutes: shiftScheduledMinutes(shift),
      },
    ]),
  );

  return { breaks, shiftRules };
}
