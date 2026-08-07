import { formatDuration, minutesBetween } from "@/lib/format";
import type { ShiftKind } from "@/lib/types/domain";

/**
 * NOI DUY NHAT biet mot ca dai bao nhieu — cho ca hai loai ca cua migration
 * 0027 (`fixed` co gio vao/gio ra, `hours` chi co do dai).
 *
 * VI SAO PHAI LA MOT NOI: truoc 0027, moi call site tu goi
 * `minutesBetween(startTime, endTime)`. Neu de nguyen nhu vay thi ca linh hoat
 * (hai gio deu `null`) se roi vao mot trong hai ket cuc, deu im lang:
 *
 *   * `minutesBetween(null, null)` -> `NaN` chay lan xuong moi phep tinh sau
 *     do, va `NaN > 0` la `false` nen khong nhanh kiem tra nao bat duoc;
 *   * hoac mot nhanh `?? 0` viet voi -> do dai ca bang 0, va do CHINH LA cai
 *     bay D-36a ma `work-mode.ts` mo ta: `overtimeMinutes = max(worked - 0, 0)`
 *     bien TOAN BO gio lam thanh tang ca, roi 05-2-04 nhan no voi he so. Luong
 *     gap ruoi ma khong mot dong loi nao.
 *
 * Module THUAN: khong dung client co so du lieu, khong doc bien moi truong,
 * khong doc dong ho he thong — cung khuon `work-mode.ts` / `classification.ts`.
 */

/** Phan cua mot ca ma cac ham duoi day can — nhan ca `Shift` lan dong tho da doi ten. */
export interface ShiftScheduleInfo {
  kind: ShiftKind;
  /** "HH:mm" — `null` o ca linh hoat */
  startTime: string | null;
  /** "HH:mm" — `null` o ca linh hoat */
  endTime: string | null;
  /** Phut — `null` o ca `fixed` */
  durationMinutes: number | null;
}

export function isHoursBasedShift(shift: { kind: ShiftKind }): boolean {
  return shift.kind === "hours";
}

/**
 * Do dai TRON CA ke ca gio nghi, phut.
 *
 * - `fixed`: hieu giua gio ra va gio vao, da xu ly ca qua dem.
 * - `hours`: chinh `durationMinutes` — ca linh hoat khong co gio nghi rieng
 *   (rang buoc `shifts_shape_check` bat `break_minutes = 0`), nen "tron ca" va
 *   "gio lam viec that" la mot.
 *
 * Tra `0` khi ca thieu du lieu de tinh — mot dong `shifts` nhu vay khong ton
 * tai duoc sau 0027, nen day chi la duong lui cho du lieu di truoc migration.
 */
export function shiftGrossMinutes(shift: ShiftScheduleInfo): number {
  if (shift.kind === "hours") {
    return shift.durationMinutes ?? 0;
  }
  if (!shift.startTime || !shift.endTime) return 0;
  return minutesBetween(shift.startTime, shift.endTime);
}

/**
 * Do dai ca THEO KE HOACH da tru gio nghi, phut — mau so cua phep tinh tang ca
 * (`work-mode.ts`) va cua ty le tru gio nghi (`day.ts`).
 */
export function shiftScheduledMinutes(
  shift: ShiftScheduleInfo & { breakMinutes: number },
): number {
  return Math.max(shiftGrossMinutes(shift) - shift.breakMinutes, 0);
}

/**
 * Nhan gio giac cua mot ca cho giao dien: "06:00–14:00" hoac "10 giờ / ngày".
 *
 * Gop vao day thay vi de moi man hinh tu noi chuoi, vi sau 0027 moi noi hien
 * `${startTime}–${endTime}` deu se in ra "null–null" cho ca linh hoat.
 */
export function formatShiftSchedule(shift: ShiftScheduleInfo): string {
  if (shift.kind === "hours") {
    return `${formatDuration(shift.durationMinutes ?? 0)} / ngày`;
  }
  return `${shift.startTime ?? "—"}–${shift.endTime ?? "—"}`;
}

/** "Ca sáng (06:00–14:00)" / "Ca linh hoạt 10 giờ (10 giờ / ngày)" */
export function formatShiftLabel(
  shift: ShiftScheduleInfo & { name: string },
): string {
  return `${shift.name} (${formatShiftSchedule(shift)})`;
}

/* -------------------------------------------------------------------------- */
/* Ca linh hoat sinh tu man hinh nhan vien                                     */
/* -------------------------------------------------------------------------- */

/**
 * Gioi han so gio mot ngay khai duoc. Tran 24 la mot su that cua lich, khong
 * phai mot muc nghiep vu ai do chon — nen no duoc phep nam trong ma (khac voi
 * `standardHoursPerDay`, thu ma D-26 cam doan ho).
 */
export const MIN_SHIFT_HOURS = 0.5;
export const MAX_SHIFT_HOURS = 24;

/**
 * Ten va ma cua ca linh hoat duoc SINH TU CHINH SO GIO, khong phai do nguoi
 * dung dat. Nho vay hai nhan vien cung khai 10 gio dung CHUNG mot dong
 * `shifts` thay vi tao ra hai ca trung noi dung — va man hinh Ca lam viec
 * khong day len mot dong moi cho moi lan them nguoi.
 */
export function hoursShiftName(durationMinutes: number): string {
  return `Ca linh hoạt ${formatDuration(durationMinutes)}`;
}

export function hoursShiftCode(durationMinutes: number): string {
  return `FLEX-${durationMinutes}`;
}

/** 10 -> 600. Lam tron ve phut vi 7,5 gio la mot muc khai that. */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

/** 600 -> 10 */
export function minutesToHours(minutes: number): number {
  return minutes / 60;
}
