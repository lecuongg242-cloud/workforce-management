import type { WorkDayType } from "@/lib/attendance/classification";
import type { DayClassification } from "@/lib/attendance/classification-context";
import type {
  DayCredit,
  WorkModeMissingInput,
} from "@/lib/attendance/work-mode";
import type { RateMissingInput } from "@/lib/payroll/rate";
import type {
  AttendanceStatus,
  EmployeeOvertimeRate,
  OvertimeRuleKey,
  WorkMode,
} from "@/lib/types/domain";

/**
 * TIEN CUA MOT NGAY.
 *
 * Module THUAN: khong dung client co so du lieu, khong doc bien moi truong,
 * khong doc dong ho he thong — cung khuon `compute.ts` / `work-mode.ts`.
 *
 * ======================================================================
 * VI SAO FILE NAY TON TAI
 * ======================================================================
 *
 * `compute.ts` tinh tien tu SO TONG cua ca ky. Mot bang luong nhu vay tra loi
 * duoc "thang nay bao nhieu" nhung khong tra loi duoc "ngay 12 toi duoc bao
 * nhieu" — va do la cau hoi nguoi lam cong hoi truoc tien.
 *
 * File nay quy MOT ngay ra tien. Tu day `computePayrollLine()` khong con nhan
 * tu so tong nua ma CONG cac dong ngay lai, nen tong LUON bang dung tong cac
 * dong hien ra.
 *
 * ======================================================================
 * BA RANG BUOC KE THUA TU `compute.ts`, KHONG DUOC NOI LONG
 * ======================================================================
 *
 * (1) KHONG TINH LAI GIO TANG CA. `classification.convertedOvertimeHours` la
 * nguon duy nhat; viec cua file nay la NHAN no voi don gia gio.
 *
 * (2) KHONG THAY MOT GIA TRI THIEU BANG 0. Thieu mot phan thi `dayTotal` cung
 * `null` — cong phan da biet lai roi trinh bay nhu mot con so day du la cach
 * tao ra mot con so SAI ma trong hoan toan dung.
 *
 * (3) LAM TRON DUNG MOT LAN CHO MOI CON SO HIEN RA. Don gia va cac phep nhan
 * la buoc TRUNG GIAN, khong bao gio duoc lam tron. Bon con so cuoi cua mot
 * ngay (`basePay`, `overtimePay`, `hourAdjustment`, va tong cua chung) moi la
 * cho lam tron.
 *
 * ======================================================================
 * NGAY DANG DO KHONG PHAI NGAY THIEU DU KIEN
 * ======================================================================
 *
 * Hai trang thai nay TUYET DOI khong duoc gop:
 *
 *   - `in_progress` — nguoi do da cham vao, chua cham ra. Con so CHUA TON TAI.
 *     Ngay nay khong lam tong cua ky thanh `null`; no chi khong gop gi vao.
 *   - thieu du kien — con so LE RA phai co nhung khong tinh duoc. Ngay nay
 *     KEO CA KY thanh `null`, dung nhu `sumCreditedDays()` dang lam.
 *
 * Gop chung lai thi mot nguoi dang lam do se lam ca bang luong bao "thieu du
 * kien", va ke toan se di tim mot loi khong ton tai.
 */

/**
 * Moi ly do khien mot dong luong khong ra duoc con so.
 *
 * DINH NGHIA NAM O DAY chu khong o `compute.ts`, du `compute.ts` moi la noi
 * xuat no ra cho ca du an: `compute.ts` import gia tri tu file nay, nen dat
 * kieu o ben kia se tao mot vong import giua hai module. Vong do se chi la
 * kieu (bi xoa luc bien dich) nen no CHAY duoc — va do chinh la ly do khong
 * nen de no ton tai: mot vong chay duoc hom nay se hong vao ngay ai do can
 * mot GIA TRI thay vi mot kieu.
 */
export type PayrollMissingInput =
  | "pay_rate"
  | RateMissingInput
  | WorkModeMissingInput
  | `overtime_rule:${OvertimeRuleKey}`;

/** Mot ngay o trang thai nao trong bang luong. */
export type DailyPayState =
  | "counted"
  | "in_progress"
  | "leave_paid"
  | "leave_unpaid";

/**
 * SO LIEU CONG cua mot ngay — phan KHONG dinh gi toi tien.
 *
 * `MonthlyDayDetail` cua `month-context.ts` thoa man kieu nay ve mat cau truc,
 * nen no di thang vao day khong can chuyen doi. Kieu duoc khai o file NAY chu
 * khong import tu do, vi `month-context.ts` la module server-only (no goi
 * `createServerSupabase()`) va file nay phai thuan.
 */
export interface DailyPaySource {
  /** "YYYY-MM-DD" */
  date: string;
  /** Trang thai cua CA NGAY (`day.ts`), khong phai cua mot luot. */
  status: AttendanceStatus;
  /** Con mot luot da vao nhung chua tan ca. */
  hasOpenPunch: boolean;
  /** Tu `resolveDayCredit()` — KHONG tinh lai o day. */
  credit: DayCredit;
  /** Tu `classifyDay()` — KHONG tinh lai o day. */
  classification: DayClassification;
}

/** Phan GIA cua phep tinh — khong doi trong suot mot ky. */
export interface DailyPayRates {
  /** `null` = chua khai muc luong HOAC thieu mau so quy doi. */
  dailyRate: number | null;
  hourlyRate: number | null;
  /**
   * Muc tang ca RIENG cua nguoi nay (0026); `null` = an theo he so cua doanh
   * nghiep.
   */
  overtimeRate: Pick<EmployeeOvertimeRate, "valueType" | "value"> | null;
  workMode: WorkMode;
  /**
   * `workMode === "daily_hours" || payRate.unit === "hour"` — noi goi tinh MOT
   * LAN cho ca ky roi truyen xuong, de moi ngay khong tu suy lai mot dieu kien
   * von khong doi trong ky.
   */
  paysByActualHours: boolean;
}

/** Mot ngay (so lieu cong) cong voi phan gia cua ky. */
export type DailyPayInput = DailyPaySource & DailyPayRates;

/**
 * TIEN TANG CA CUA MOT LUOT.
 *
 * CHI CO TIEN TANG CA, khong co luong co ban. O che do `shift` — che do moi
 * doanh nghiep dang chay — luong co ban la tien cua MOT NGAY CONG, mot khoan
 * phang khong tang theo so gio. Chia no cho ba luot la bia ra mot con so:
 * khong co cau tra loi dung nao cho "luong co ban cua luot dai 21 phut". Tien
 * tang ca thi nguoc lai — no ra tu chinh so phut cua luot do, nen chia duoc
 * chinh xac den tung dong.
 */
export interface DailyPunchPay {
  /** Chi so cua luot trong `day.punches` — de noi goi ghep lai khong phai doan. */
  index: number;
  overtimeMinutes: number;
  /** `null` khi tien tang ca cua ca ngay chua tinh duoc. */
  overtimePay: number | null;
}

export interface DailyPayLine {
  date: string;
  dayType: WorkDayType;
  state: DailyPayState;
  /** So ngay cong cua ngay — co the thap phan o `daily_hours` (D-39). */
  creditedDays: number | null;
  regularMinutes: number | null;
  overtimeMinutes: number;
  convertedOvertimeHours: number | null;
  hourDeltaMinutes: number;
  /** DA LAM TRON. `null` khi chua tinh duoc — xem `state` va `missing`. */
  basePay: number | null;
  overtimePay: number | null;
  hourAdjustment: number | null;
  /** Tong ba con so DA LAM TRON o tren. */
  dayTotal: number | null;
  /**
   * Tien tang ca cua tung luot. RONG khi ngay do khong co tang ca, va rong khi
   * ban phan loai khong mang theo phan tach luot (ky da chot doc tu ban chup —
   * xem `payroll_line_days`, no luu theo NGAY chu khong theo luot).
   */
  punches: DailyPunchPay[];
  missing: PayrollMissingInput[];
}

export interface DailyPaySum {
  basePay: number | null;
  overtimePay: number | null;
  hourAdjustment: number | null;
  dayTotal: number | null;
  missing: PayrollMissingInput[];
}

/** Lam tron TOI DONG, nua len — cung phep voi `compute.ts`. */
function roundToDong(value: number): number {
  return Math.round(value);
}

/**
 * Chia TIEN TANG CA CUA MOT NGAY ve tung luot theo trong so.
 *
 * HAI RANG BUOC, va rang buoc thu hai la ly do ham nay ton tai thay vi mot
 * phep nhan viet thang o noi goi:
 *
 * (1) TONG CAC LUOT BANG DUNG TIEN CUA NGAY. Lam tron tung luot roi cong lai
 *     gan nhu luon lech vai dong so voi con so cua ngay — va mot the ngay ma
 *     ba dong con khong cong lai thanh dong thu tu la mot the khong ai tin.
 *     Vi vay luot CUOI CUNG nhan phan con lai chu khong nhan phep nhan cua no.
 *
 * (2) TRONG SO KHONG DUOC LA SO PHUT THO khi co phu cap dem — xem chu thich
 *     cua `PunchClassification`. Noi goi chon trong so cho khop voi CHINH cach
 *     tien tang ca cua ngay duoc tinh ra.
 *
 * Tong trong so bang 0 (co tang ca nhung moi trong so deu 0) tra ve tien 0 cho
 * moi luot — khong chia cho 0, va khong bo mat dong nao vi khi ay tien cua
 * ngay cung bang 0.
 */
function allocateOvertimePay({
  weights,
  total,
}: {
  weights: readonly number[];
  total: number;
}): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0) return weights.map(() => 0);

  const allocated = weights.map((weight) => roundToDong((total * weight) / sum));
  // Chi so cua luot cuoi CO trong so — dồn phan du vao mot luot khong tang ca
  // se lam hien ra mot khoan tien ben canh chu "khong tang ca".
  let lastIndex = -1;
  for (let index = weights.length - 1; index >= 0; index -= 1) {
    if (weights[index] > 0) {
      lastIndex = index;
      break;
    }
  }
  if (lastIndex >= 0) {
    const others = allocated.reduce(
      (acc, value, index) => (index === lastIndex ? acc : acc + value),
      0,
    );
    allocated[lastIndex] = total - others;
  }
  return allocated;
}

function stateOf({
  status,
  hasOpenPunch,
}: {
  status: AttendanceStatus;
  hasOpenPunch: boolean;
}): DailyPayState {
  // Ngay dang do duoc xet TRUOC hai trang thai nghi: mot dong nghi phep khong
  // co luot nao nen khong bao gio co luot mo, nen thu tu nay khong che khuat
  // gi hom nay — nhung neu ve sau no co, thi "dang do" van la su that gan hon
  // voi hien tai.
  if (hasOpenPunch) return "in_progress";
  if (status === "leave_paid") return "leave_paid";
  if (status === "leave_unpaid") return "leave_unpaid";
  return "counted";
}

export function computeDailyPay({
  date,
  credit,
  classification,
  status,
  hasOpenPunch,
  dailyRate,
  hourlyRate,
  overtimeRate,
  workMode,
  paysByActualHours,
}: DailyPayInput): DailyPayLine {
  const state = stateOf({ status, hasOpenPunch });

  const shared = {
    date,
    dayType: classification.dayType,
    state,
    creditedDays: credit.creditedDays,
    regularMinutes: credit.regularMinutes,
    overtimeMinutes: classification.overtimeMinutes,
    convertedOvertimeHours: classification.convertedOvertimeHours,
    hourDeltaMinutes: credit.hourDelta,
  };

  // NGAY DANG DO. Khong con so nao, va `missing` RONG — day khong phai mot
  // dong thieu du kien (xem khoi comment o dau file).
  if (state === "in_progress") {
    return {
      ...shared,
      basePay: null,
      overtimePay: null,
      hourAdjustment: null,
      dayTotal: null,
      punches: [],
      missing: [],
    };
  }

  const missing = new Set<PayrollMissingInput>();
  if (credit.missing !== null) missing.add(credit.missing);
  for (const key of classification.missingMultiplierKeys) {
    // Nguoi co muc tang ca RIENG khong an theo he so cua doanh nghiep, nen mot
    // he so doanh nghiep chua khai khong duoc chan tien cua ho.
    if (overtimeRate !== null) continue;
    missing.add(`overtime_rule:${key}`);
  }

  /* ------------------------------------------------------------------ */
  /* Luong goc — theo GIO THUC TE hay theo NGAY CONG                     */
  /* ------------------------------------------------------------------ */
  const basePayExact = paysByActualHours
    ? hourlyRate !== null && credit.regularMinutes !== null
      ? hourlyRate * (credit.regularMinutes / 60)
      : null
    : dailyRate !== null && credit.creditedDays !== null
      ? dailyRate * credit.creditedDays
      : null;

  /* ------------------------------------------------------------------ */
  /* Lech gio — CHI o `shift_hourly`                                      */
  /* ------------------------------------------------------------------ */
  // `credit.hourDelta` AM khi thieu gio, nen phep nhan tu ra mot so am; khong
  // co nhanh rieng nao cho "thieu gio" va do la co y.
  //
  // `paysByActualHours` bi loai TUYET DOI: luong goc cua ho da bam dung gio
  // thuc te roi, cong them phan lech gio nua la tinh HAI LAN cung so gio do.
  const hourAdjustmentExact =
    workMode === "shift_hourly" && !paysByActualHours
      ? hourlyRate !== null
        ? hourlyRate * (credit.hourDelta / 60)
        : null
      : 0;

  /* ------------------------------------------------------------------ */
  /* Tang ca                                                              */
  /* ------------------------------------------------------------------ */
  const overtimeHours = classification.overtimeMinutes / 60;
  let overtimePayExact: number | null;
  if (overtimeRate === null) {
    // Duong cu, quy tac (1): NHAN gio quy doi voi don gia gio. He so theo loai
    // ngay va phu cap dem da duoc ap o tang tren, khong tinh lai o day.
    overtimePayExact =
      hourlyRate !== null && classification.convertedOvertimeHours !== null
        ? hourlyRate * classification.convertedOvertimeHours
        : null;
  } else if (overtimeRate.valueType === "fixed_hourly") {
    // So TIEN, nen khong nhan voi don gia gio — nguoi khai muc co dinh tinh
    // duoc tien tang ca ngay ca khi doanh nghiep chua khai he so nao.
    overtimePayExact = overtimeHours * overtimeRate.value;
  } else {
    // Muc rieng THAY CHO toan bo he so theo loai ngay, nen phai quay ve SO GIO
    // THO — `convertedOvertimeHours` (da nhan he so doanh nghiep) khong dung.
    overtimePayExact =
      hourlyRate !== null ? hourlyRate * overtimeHours * overtimeRate.value : null;
  }

  // CON SO CUOI cua ngay — moi o lam tron DUNG MOT LAN tu gia tri chinh xac.
  const basePay = basePayExact === null ? null : roundToDong(basePayExact);
  const overtimePay =
    overtimePayExact === null ? null : roundToDong(overtimePayExact);
  const hourAdjustment =
    hourAdjustmentExact === null ? null : roundToDong(hourAdjustmentExact);

  // BAT KY phan nao `null` thi `dayTotal` cung `null` (quy tac (2)).
  const dayTotal =
    basePay === null || overtimePay === null || hourAdjustment === null
      ? null
      : basePay + overtimePay + hourAdjustment;

  /* ------------------------------------------------------------------ */
  /* Tien tang ca theo TUNG LUOT                                          */
  /* ------------------------------------------------------------------ */
  // TRONG SO PHAI KHOP VOI CHINH PHEP TINH O TREN, khong phai voi mot y niem
  // chung ve "luot nay lam nhieu hon". Hai duong tinh tien tang ca dung hai dai
  // luong khac nhau:
  //
  //   duong cu (khong co muc rieng) -> GIO QUY DOI, da mang he so loai ngay
  //                                    va phu cap dem
  //   co muc rieng                  -> GIO THO, vi muc rieng thay cho toan bo
  //                                    he so (xem nhanh tinh `overtimePayExact`)
  //
  // Dung nham mot trong hai se chia lech giua cac luot dung o cho no quan trong
  // nhat: mot nguoi lam dem se thay tien cua minh chay sang luot ban ngay.
  const punchSources = classification.punches ?? [];
  const weights = punchSources.map((punch) =>
    overtimeRate === null ? (punch.convertedOvertimeHours ?? 0) : punch.overtimeMinutes,
  );
  const shares =
    overtimePay === null
      ? null
      : allocateOvertimePay({ weights, total: overtimePay });

  const punches: DailyPunchPay[] = punchSources.map((punch, index) => ({
    index,
    overtimeMinutes: punch.overtimeMinutes,
    overtimePay: shares === null ? null : shares[index],
  }));

  return {
    ...shared,
    basePay,
    overtimePay,
    hourAdjustment,
    dayTotal,
    punches,
    missing: Array.from(missing),
  };
}

/**
 * Quy CA MOT KY ra cac dong ngay. Phan gia (`rates`) khong doi trong ky nen
 * duoc tinh MOT LAN o noi goi roi dung lai cho moi ngay.
 */
export function computeDailyLines({
  days,
  rates,
}: {
  days: readonly DailyPaySource[];
  rates: DailyPayRates;
}): DailyPayLine[] {
  return days.map((day) => computeDailyPay({ ...day, ...rates }));
}

/**
 * Cong cac dong ngay lai thanh so cua ky.
 *
 * Ngay `in_progress` KHONG gop gi va KHONG lam tong thanh `null` — no chua co
 * con so, chu khong phai thieu con so.
 */
export function sumDailyPay(lines: readonly DailyPayLine[]): DailyPaySum {
  const missing = new Set<PayrollMissingInput>();
  // BA THANH PHAN DOC LAP NHAU. Mot ngay thieu he so tang ca lam `overtimePay`
  // cua ca ky thanh `null`, nhung luong goc thi VAN tinh duoc va van phai duoc
  // hien — nguoi xem can biet phan nao ra so va phan nao khong. Gop ca ba lai
  // se giau di thu ma he thong that su biet.
  let base: number | null = 0;
  let overtime: number | null = 0;
  let hour: number | null = 0;

  for (const line of lines) {
    for (const key of line.missing) missing.add(key);
    // Ngay chua ket thuc thi khong co gi de cong — va no KHONG lam thanh phan
    // nao thanh `null`, vi no khong thieu du kien.
    if (line.state === "in_progress") continue;

    if (line.basePay === null) base = null;
    else if (base !== null) base += line.basePay;

    if (line.overtimePay === null) overtime = null;
    else if (overtime !== null) overtime += line.overtimePay;

    if (line.hourAdjustment === null) hour = null;
    else if (hour !== null) hour += line.hourAdjustment;
  }

  return {
    basePay: base,
    overtimePay: overtime,
    hourAdjustment: hour,
    // BAT KY thanh phan nao `null` thi tong cung `null` — khong cong phan da
    // biet lai roi trinh bay nhu mot con so day du (quy tac (2)).
    dayTotal:
      base === null || overtime === null || hour === null
        ? null
        : // Tong cua CHINH nhung o hien ra man hinh — luon doi chieu duoc.
          base + overtime + hour,
    missing: Array.from(missing),
  };
}
