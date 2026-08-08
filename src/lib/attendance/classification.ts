import type { OvertimeRuleKey, WeekdayNumber } from "@/lib/types/domain";

/**
 * Phan loai cong theo quy tac ma CHINH doanh nghiep da khai (SET-04, plan
 * 04-05). Module THUAN: khong import Supabase, khong doc `process.env`, khong
 * goi `new Date()` — kiem duoc tung nhanh bang Vitest, cung khuon
 * `src/lib/attendance/suspicious.ts`.
 *
 * BA DIEU CAN BIET TRUOC KHI SUA FILE NAY
 *
 * (1) MOI THU O DAY TINH TAI THOI DIEM TRUY VAN, khong co cot nao luu ket qua.
 *     Day la cung khuon voi co dang ngo cua 03-06 (xem comment migration 0011
 *     dong 56-60): mot cot da ghi cung nghia la du lieu lich su mang phan
 *     quyet theo mot quy tac cu ma khong ai con biet quy tac do la gi.
 *
 * (2) HE SO CONG DON HAI LOP (D-28a, chot 2026-08-06):
 *
 *       he so cua mot phut = he so LOAI NGAY (thuong | cuoi tuan | le)
 *                            + phu cap DEM, neu phut do nam trong khung dem
 *
 *     Vi du: le 3.0 va phu cap dem 0.3 -> mot gio tang ca ban dem ngay le quy
 *     doi x3.3. KHONG nhan chong (x3.9) va khong bo qua phan dem (x3.0).
 *     GIOI HAN da biet: Dieu 98.3 Bo luat Lao dong con mot lop thu ba (tang ca
 *     ban dem duoc cong them 20% tien luong ban ngay cua chinh ngay do) — V2
 *     KHONG lam lop nay, no can mot khoa thu nam va mot migration.
 *
 * (3) THIEU HE SO TRA `null`, KHONG BAO GIO 1.0 (D-26). Mot gia tri mac dinh
 *     ngam lam man hinh trong nhu da tinh dung trong khi doanh nghiep chua
 *     khai gi — sai lang le, kho phat hien nhat.
 */

/** Ba loai ngay LOAI TRU NHAU. `night` KHONG nam o day: no la mot chieu doc lap. */
export type WorkDayType = "weekday" | "weekend" | "holiday";

const MINUTES_PER_DAY = 1440;

function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/* -------------------------------------------------------------------------- */
/* Loai ngay                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Thu trong tuan theo quy uoc ISO (1 = Thu Hai ... 7 = Chu Nhat) tu mot chuoi
 * "YYYY-MM-DD".
 *
 * Tu tinh bang cong thuc lich (thuat toan Sakamoto) thay vi `new Date(...)`:
 * `new Date("YYYY-MM-DD")` duoc dien giai la UTC, nen o mui gio am no lui mot
 * ngay va thu trong tuan lech — dung loai loi ma quy uoc thoi gian cua du an
 * (D-07/D-19) ton tai de tranh.
 */
export function isoWeekday(date: string): WeekdayNumber {
  const [year, month, day] = date.split("-").map(Number);
  const table = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = month < 3 ? year - 1 : year;
  const sunday0 =
    (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + table[month - 1] + day) %
    7;
  // Sakamoto tra 0 = Chu Nhat; quy uoc cua du an la 7 = Chu Nhat.
  return (sunday0 === 0 ? 7 : sunday0) as WeekdayNumber;
}

/**
 * Loai ngay cua mot ngay cong.
 *
 * - `holiday` khi ngay nam trong danh sach ngay le CUA CHINH doanh nghiep
 *   (bang `holidays`, co y de rong khi khoi tao — D-26).
 * - `weekend` khi thu trong tuan KHONG thuoc `workingDays` CUA CA. Khong bao
 *   gio gia dinh Thu Bay/Chu Nhat: mot xuong san xuat co the lam ca tuan va
 *   nghi Thu Tu.
 * - Ngay vua la ngay le vua ngoai lich lam viec tra `holiday` — le uu tien.
 */
export function classifyWorkDay({
  workDate,
  holidayDates,
  workingDays,
}: {
  workDate: string;
  /** Cac ngay "YYYY-MM-DD" doanh nghiep da khai la ngay le. */
  holidayDates: ReadonlySet<string> | readonly string[];
  /** `shifts.working_days` cua ca ma ban ghi thuoc ve. */
  workingDays: readonly WeekdayNumber[];
}): WorkDayType {
  const holidays =
    holidayDates instanceof Set ? holidayDates : new Set(holidayDates as readonly string[]);
  if (holidays.has(workDate)) return "holiday";
  return workingDays.includes(isoWeekday(workDate)) ? "weekday" : "weekend";
}

/* -------------------------------------------------------------------------- */
/* Doan thoi gian trong mot ngay cong                                          */
/* -------------------------------------------------------------------------- */

/** Mot luot cham cong da hoan tat, dang "HH:mm". */
export interface PunchTimes {
  checkIn: string;
  /** `null` khi luot chua tan ca — luot do khong duoc tinh vao doan nao. */
  checkOut: string | null;
}

/**
 * Doan thoi gian TUYET DOI trong mot ngay cong, tinh bang phut ke tu nua dem
 * cua NGAY BAT DAU. Gia tri co the vuot 1440: ca qua dem duoc tinh tron vao
 * ngay bat dau (D-08), nen 02:00 hom sau la 1560 chu khong phai 120.
 */
export interface WorkSegment {
  start: number;
  end: number;
}

/**
 * Doi cac luot "HH:mm" thanh doan tuyet doi, tu suy ra viec vuot qua nua dem
 * bang cach giu mot con tro chi tien: moc nao nho hon con tro thi thuoc ngay
 * hom sau. Luot chua tan ca bi bo qua (khong doan mot gio ra khong ton tai).
 */
export function toWorkSegments(punches: readonly PunchTimes[]): WorkSegment[] {
  const segments: WorkSegment[] = [];
  let cursor = 0;

  for (const punch of punches) {
    if (!punch.checkOut) continue;

    let start = timeToMinutes(punch.checkIn);
    while (start < cursor) start += MINUTES_PER_DAY;

    let end = timeToMinutes(punch.checkOut);
    while (end < start) end += MINUTES_PER_DAY;

    segments.push({ start, end });
    cursor = end;
  }

  return segments;
}

function overlapMinutes(a: WorkSegment, b: WorkSegment): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/**
 * Cac cua so DEM phu het pham vi mot ngay cong (ke ca phan vuot sang hom sau
 * cua ca qua dem). Khung dem vat qua nua dem (vi du 22:00-06:00) duoc trai
 * thanh nhieu cua so lien tiep, nen khong nhanh nao phai xu ly rieng.
 */
function nightWindows(nightStart: string, nightEnd: string): WorkSegment[] {
  const startMinutes = timeToMinutes(nightStart);
  const endMinutes = timeToMinutes(nightEnd);
  const length =
    endMinutes > startMinutes ? endMinutes - startMinutes : endMinutes + MINUTES_PER_DAY - startMinutes;

  // -1 de bat phan dem cua dem HOM TRUOC keo sang sang nay; 0,1,2 cho chinh
  // ngay cong va phan vuot sang hom sau.
  return [-1, 0, 1, 2].map((day) => ({
    start: day * MINUTES_PER_DAY + startMinutes,
    end: day * MINUTES_PER_DAY + startMinutes + length,
  }));
}

/** So phut cua cac doan giao voi khung gio dem. */
export function nightMinutes({
  segments,
  nightStart,
  nightEnd,
}: {
  segments: readonly WorkSegment[];
  nightStart: string;
  nightEnd: string;
}): number {
  if (nightStart === nightEnd) return 0;
  const windows = nightWindows(nightStart, nightEnd);
  let total = 0;
  for (const segment of segments) {
    for (const window of windows) {
      total += overlapMinutes(segment, window);
    }
  }
  return total;
}

/* -------------------------------------------------------------------------- */
/* Phut tang ca                                                                */
/* -------------------------------------------------------------------------- */

/**
 * So phut tang ca cua mot ngay.
 *
 * - Ngay le va ngay nghi: TOAN BO gio lam la tang ca — lam viec vao mot ngay
 *   khong phai ngay lam la tang ca tu phut dau tien.
 * - Ngay thuong: phan VUOT tren do dai ca theo ke hoach, san 0.
 */
export function overtimeMinutes({
  workedMinutes,
  scheduledMinutes,
  dayType,
}: {
  workedMinutes: number;
  /** Do dai ca theo ke hoach da tru gio nghi (`tf_shift_minutes`). */
  scheduledMinutes: number;
  dayType: WorkDayType;
}): number {
  if (workedMinutes <= 0) return 0;
  if (dayType !== "weekday") return workedMinutes;
  return Math.max(workedMinutes - scheduledMinutes, 0);
}

/**
 * PHAN TANG CA CUA TUNG DOAN, giu nguyen chi so cua `segments`.
 *
 * Tang ca duoc coi la phan CUOI cua thoi gian lam viec trong ngay — nguoi ta
 * o lai lam them sau khi da lam du ca, khong phai lam them trong luc dang lam
 * ca. Vi vay ham nay cat lay `overtime` phut CUOI CUNG cua chuoi doan, di
 * nguoc tu doan cuoi; doan nao khong dinh gi toi phan duoi cung tra `null`.
 *
 * DAY LA DINH NGHIA DUY NHAT cua "phut nao la phut tang ca". Ca phep tinh phut
 * tang ca ban dem lan phep chia tien tang ca theo luot deu doc tu day, nen
 * khong the co chuyen mot phut duoc tinh la tang ca o phep nay va khong o phep
 * kia.
 */
function overtimeTail(
  segments: readonly WorkSegment[],
  overtime: number,
): (WorkSegment | null)[] {
  const tail: (WorkSegment | null)[] = segments.map(() => null);
  let remaining = overtime;
  for (let index = segments.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const segment = segments[index];
    const length = segment.end - segment.start;
    const take = Math.min(length, remaining);
    tail[index] = { start: segment.end - take, end: segment.end };
    remaining -= take;
  }
  return tail;
}

/**
 * Phan phut tang ca NAM TRONG khung gio dem.
 *
 * VI SAO KHONG DUNG `Math.min(nightMinutes, overtimeMinutes)`: mot ca dem
 * 22:00-06:00 lam den 08:00 co 480 phut dem nhung phan tang ca (06:00-08:00)
 * KHONG co phut dem nao. Phep min() se tra 120 — nhieu gap boi so that va cong
 * them mot khoan phu cap khong ai lam ra.
 */
export function overtimeNightMinutes({
  segments,
  overtimeMinutes: overtime,
  nightStart,
  nightEnd,
}: {
  segments: readonly WorkSegment[];
  overtimeMinutes: number;
  nightStart: string;
  nightEnd: string;
}): number {
  if (overtime <= 0) return 0;

  const tail = overtimeTail(segments, overtime).filter(
    (part): part is WorkSegment => part !== null,
  );
  return nightMinutes({ segments: tail, nightStart, nightEnd });
}

/** Phan tang ca cua MOT luot cham cong. */
export interface PunchOvertimeSplit {
  /** Phut cua luot KHONG phai tang ca. */
  regularMinutes: number;
  overtimeMinutes: number;
  /** Phan tang ca cua luot nay roi vao khung gio dem. */
  overtimeNightMinutes: number;
}

/**
 * Tach TUNG DOAN thanh phan trong ca va phan tang ca.
 *
 * Tra ve mot phan tu cho MOI doan, dung thu tu — noi goi anh xa nguoc ve luot
 * cua minh bang chi so. Tong `overtimeMinutes` cua ket qua bang dung tham so
 * `overtimeMinutes` truyen vao (tru khi tong do dai cac doan con nho hon no,
 * luc ay lay het), va tong `overtimeNightMinutes` bang dung
 * `overtimeNightMinutes()` cua cung mot ngay — hai ham dung chung `overtimeTail`.
 *
 * LUU Y VE GIO NGHI: `overtimeMinutes` cua mot ngay duoc tinh tu so phut DA TRU
 * gio nghi, con cac doan o day la THO. Nen `regularMinutes` cong lai co the lon
 * hon so gio duoc tinh cong cua ngay dung bang so phut nghi. Phan tang ca thi
 * khong bi anh huong — no la phan cuoi, va gio nghi khong bao gio nam o cuoi
 * ngay. Day cung la ly do chi PHAN TANG CA duoc dung de chia tien.
 */
export function splitPunchOvertime({
  segments,
  overtimeMinutes: overtime,
  nightStart,
  nightEnd,
}: {
  segments: readonly WorkSegment[];
  overtimeMinutes: number;
  nightStart: string;
  nightEnd: string;
}): PunchOvertimeSplit[] {
  const tail = overtime > 0 ? overtimeTail(segments, overtime) : segments.map(() => null);

  return segments.map((segment, index) => {
    const part = tail[index];
    const overtimeOfPunch = part === null ? 0 : part.end - part.start;
    return {
      regularMinutes: segment.end - segment.start - overtimeOfPunch,
      overtimeMinutes: overtimeOfPunch,
      overtimeNightMinutes:
        part === null
          ? 0
          : nightMinutes({ segments: [part], nightStart, nightEnd }),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Quy doi                                                                     */
/* -------------------------------------------------------------------------- */

/** He so doanh nghiep da khai, `null` nghia la CHUA KHAI (khong phai 1.0). */
export type OvertimeMultipliers = Partial<Record<OvertimeRuleKey, number | null>>;

/**
 * He so DANG HIEU LUC tai `date`: phien ban co `effectiveFrom` lon nhat ma van
 * nho hon hoac bang `date`. Tra `null` khi `date` nam TRUOC moi phien ban —
 * KHONG lui ve phien ban gan nhat (D-26).
 *
 * Day la BAN JS cua `public.tf_overtime_multiplier` (migration 0016). Hai ban
 * ton tai vi tang doc phai phan giai he so cho ca mot thang trong MOT truy van
 * (goi RPC cho tung ngay x tung khoa la vai chuc round-trip cho mot man hinh).
 * Su trung lap nay duoc canh bang mot test doi chieu: `overtime-multiplier-parity`
 * chay ca hai tren cung du lieu that va doi chung tra ve cung ket qua.
 */
export function resolveMultiplier(
  versions: readonly { effectiveFrom: string; multiplier: number }[],
  date: string,
): number | null {
  let best: { effectiveFrom: string; multiplier: number } | null = null;
  for (const version of versions) {
    if (version.effectiveFrom > date) continue;
    if (best === null || version.effectiveFrom > best.effectiveFrom) {
      best = version;
    }
  }
  return best?.multiplier ?? null;
}

/** Khoa `overtime_rules` tuong ung voi mot loai ngay. */
export function ruleKeyForDayType(dayType: WorkDayType): OvertimeRuleKey {
  return dayType;
}

export interface ConvertedOvertime {
  /** Gio tang ca quy doi; `null` khi thieu he so can thiet (D-26). */
  hours: number | null;
  /** Cac khoa thieu he so ma phut tuong ung lai lon hon 0. */
  missingKeys: OvertimeRuleKey[];
}

/**
 * Gio tang ca quy doi theo D-28a:
 *
 *   (phut tang ca x he so loai ngay + phut tang ca ban dem x phu cap dem) / 60
 *
 * Tra `hours: null` khi BAT KY phan nao co phut lon hon 0 ma thieu he so —
 * khong bao gio tra mot tong bo phan trong nhu da day du. Khong co phut tang
 * ca nao thi tra `0`, khong phai `null`: khong lam thi khong thieu gi ca.
 */
export function convertedOvertimeHours({
  dayType,
  overtimeMinutes: overtime,
  overtimeNightMinutes: overtimeNight,
  multipliers,
}: {
  dayType: WorkDayType;
  overtimeMinutes: number;
  overtimeNightMinutes: number;
  multipliers: OvertimeMultipliers;
}): ConvertedOvertime {
  if (overtime <= 0) return { hours: 0, missingKeys: [] };

  const dayKey = ruleKeyForDayType(dayType);
  const dayMultiplier = multipliers[dayKey] ?? null;
  const nightPremium = multipliers.night ?? null;

  const missingKeys: OvertimeRuleKey[] = [];
  if (dayMultiplier === null) missingKeys.push(dayKey);
  if (overtimeNight > 0 && nightPremium === null) missingKeys.push("night");

  if (missingKeys.length > 0) return { hours: null, missingKeys };

  // Khong dung `?? 0` cho phu cap dem: tai day `missingKeys` da rong, nen
  // `nightPremium` chac chan khac null MOI KHI co phut dem. Viet tuong minh
  // dieu do thay vi mot gia tri du phong — mot `?? 0` o day se lang le nuot
  // mat truong hop thieu he so neu dieu kien o tren doi ve sau.
  const nightPortion =
    overtimeNight > 0 ? overtimeNight * (nightPremium as number) : 0;
  const weighted = overtime * (dayMultiplier as number) + nightPortion;
  // Lam tron toi hai chu so thap phan — don vi hien thi la GIO, khong phai
  // tien; khong lam tron sau hon vi con so nay khong dung de thanh toan.
  return { hours: Math.round((weighted / 60) * 100) / 100, missingKeys: [] };
}
