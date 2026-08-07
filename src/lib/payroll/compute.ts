import {
  toDailyRate,
  toHourlyRate,
  type RateMissingInput,
} from "@/lib/payroll/rate";
import { isTargeted, type ScopeEmployee } from "@/lib/payroll/scope";
import type {
  EmployeeOvertimeRate,
  OvertimeRuleKey,
  PayAdjustment,
  PayRate,
  WorkMode,
  WorkModeMissingInput,
} from "@/lib/types/domain";

/**
 * PHEP TINH RA TIEN cua MOT nguoi trong MOT ky (PAY-01, plan 05-2-04).
 *
 * Module THUAN: khong dung client co so du lieu, khong doc bien moi truong,
 * khong doc dong ho he thong.
 *
 * ======================================================================
 * BA QUY TAC MA CA PLAN NAY TON TAI VI CHUNG
 * ======================================================================
 *
 * (1) KHONG TINH LAI GIO TANG CA. `convertedOvertimeHours` cua Phase 4 la
 * NGUON DUY NHAT (D-31); viec cua file nay la NHAN no voi don gia gio. Tinh
 * lai o day tao mot nguon thu hai cho cung mot con so, va khi hai nguon lech
 * nhau thi khong ai biet tin cai nao — trong khi ca hai deu tra ve mot con so
 * trong hop ly.
 *
 * (2) KHONG BAO GIO THAY MOT GIA TRI THIEU BANG 0. Thieu muc luong, thieu mau
 * so quy doi, thieu he so tang ca — ca ba deu noi len thanh `null` kem ly do.
 * Mot con so 0 trong bang luong doc nhu MOT SU THAT ("nguoi nay khong duoc tra
 * gi"), va nguoi ky duyet se ky. Mot o ghi "chua khai muc luong" thi khong ai
 * ky duoc.
 *
 * Va he qua nang hon: thieu MOT phan thi `netPay` cung `null`. Cong phan da
 * biet lai roi trinh bay nhu mot con so day du la cach tao ra mot con so SAI
 * ma trong hoan toan dung — cung lap luan voi `convertedOvertimeHours` cua
 * 04-05.
 *
 * (3) LAM TRON DUNG MOT LAN CHO MOI CON SO HIEN RA, VA KHONG SOM HON THE.
 *
 * O day co MOT CANG THANG THAT giua hai yeu cau cua phase, va no duoc giai
 * quyet CO Y THUC chu khong phai bi bo qua:
 *
 *   - D-42a: "cac buoc trung gian giu nguyen do chinh xac — lam tron tung
 *     buoc roi cong lai se lech vai dong so voi cong roi lam tron".
 *   - Rui ro cua phase: "tong phai bang dung tong cac dong", vi ke toan se
 *     doi chieu hai con so do, va lech mot dong la du de ho mat long tin vao
 *     MOI con so con lai — ke ca nhung con so dung.
 *
 * O muc mot dong, hai yeu cau nay khong the cung dung tuyet doi. Ranh gioi
 * duoc dat nhu sau:
 *
 *   BUOC TRUNG GIAN = don gia va cac phep nhan (don gia ngay, don gia gio,
 *   gio x don gia, % x don gia ngay). Nhung buoc nay KHONG BAO GIO duoc lam
 *   tron — do dung la thu D-42a mo ta, va lam tron o do gay lech HANG NGHIN
 *   dong tren mot bang luong, khong phai mot dong.
 *
 *   CON SO CUOI = tung o hien ra man hinh (luong goc, tien tang ca, tung dong
 *   khoan, hai tong khoan). Moi o duoc lam tron DUNG MOT LAN tu gia tri chinh
 *   xac cua no. `netPay` la tong cua chinh nhung o do — nen bang luong LUON
 *   doi chieu duoc, khong bao gio lech mot dong.
 *
 * Sai so con lai giua `netPay` va gia tri chinh xac tuyet doi la duoi mot dong
 * cho moi thanh phan. Do la sai so nho nhat ma dinh dang tien dong cho phep,
 * va no KHONG QUAN SAT DUOC — trong khi mot bang khong doi chieu duoc thi quan
 * sat duoc ngay.
 */

/** Moi ly do khien mot dong luong khong ra duoc con so. */
export type PayrollMissingInput =
  | "pay_rate"
  | RateMissingInput
  | WorkModeMissingInput
  | `overtime_rule:${OvertimeRuleKey}`;

/** Mot dong khoan da quy ra tien. */
export interface PayrollAdjustmentLine {
  adjustmentId: string;
  name: string;
  /** So tien DA LAM TRON — chi de hien thi. Xem quy tac (3). */
  amount: number;
  /** So lan nhan (`per_late` nhan voi so lan di muon); 1 voi `per_period`. */
  multiplier: number;
}

export interface PayrollComputeInput {
  /** So lieu cong cua nguoi do trong ky — nguon duy nhat, khong tinh lai. */
  summary: {
    creditedDays: number | null;
    regularMinutes: number | null;
    hourDeltaMinutes: number;
    /** `null` = THIEU HE SO (D-26), khong phai "khong co tang ca". */
    convertedOvertimeHours: number | null;
    /**
     * Tong so PHUT tang ca THO cua ky — chua nhan he so nao. Chi duoc dung khi
     * nguoi nay co muc tang ca rieng (0026): luc do he so theo loai ngay cua
     * doanh nghiep khong con tham gia, nen `convertedOvertimeHours` cung khong.
     */
    overtimeMinutes: number;
    missingMultiplierKeys: OvertimeRuleKey[];
    missingWorkModeInputs: WorkModeMissingInput[];
    lateCount: number;
  };
  /** `null` = CHUA KHAI MUC LUONG. */
  payRate: Pick<PayRate, "unit" | "amount"> | null;
  /**
   * Muc tang ca RIENG cua nguoi nay (0026); `null` = khong khai -> an theo he
   * so cua doanh nghiep.
   */
  overtimeRate: Pick<EmployeeOvertimeRate, "valueType" | "value"> | null;
  workMode: WorkMode;
  standardDaysPerMonth: number | null;
  standardHoursPerDay: number | null;
  /** Toan bo danh muc khoan cua doanh nghiep — loc `isActive` va pham vi o day. */
  adjustments: readonly PayAdjustment[];
  employee: ScopeEmployee;
}

export interface PayrollLine {
  /** `null` khi thieu du kien — xem `missing`. */
  basePay: number | null;
  overtimePay: number | null;
  /** Cong/tru theo gio thuc te, CHI o `shift_hourly`. Am khi thieu gio. */
  hourAdjustment: number | null;
  allowanceItems: PayrollAdjustmentLine[];
  deductionItems: PayrollAdjustmentLine[];
  allowanceTotal: number | null;
  deductionTotal: number | null;
  netPay: number | null;
  missing: PayrollMissingInput[];
}

/** Lam tron TOI DONG, nua len (D-42a). Duoc goi o dung hai cho: dong khoan va netPay. */
function roundToDong(value: number): number {
  return Math.round(value);
}

export function computePayrollLine({
  summary,
  payRate,
  overtimeRate,
  workMode,
  standardDaysPerMonth,
  standardHoursPerDay,
  adjustments,
  employee,
}: PayrollComputeInput): PayrollLine {
  const missing = new Set<PayrollMissingInput>();

  // Thieu he so tang ca (D-26) va thieu mau so quy doi ngay cong (D-38) den
  // tu tang tren; chung duoc mang xuong nguyen ven, khong bi nuot.
  for (const key of summary.missingMultiplierKeys) {
    // Nguoi co muc tang ca RIENG khong an theo he so cua doanh nghiep, nen mot
    // he so doanh nghiep chua khai khong duoc chan bang luong cua ho.
    if (overtimeRate !== null) continue;
    missing.add(`overtime_rule:${key}`);
  }
  for (const key of summary.missingWorkModeInputs) {
    missing.add(key);
  }

  const empty: PayrollLine = {
    basePay: null,
    overtimePay: null,
    hourAdjustment: null,
    allowanceItems: [],
    deductionItems: [],
    allowanceTotal: null,
    deductionTotal: null,
    netPay: null,
    missing: [],
  };

  // CHUA KHAI MUC LUONG. Khong mot con so nao tinh duoc — ke ca cac khoan
  // `fixed_amount` von khong phu thuoc vao luong: hien mot phan cua bang luong
  // cho nguoi chua co luong se doc ra thanh "day la tat ca nhung gi ho duoc
  // tra".
  if (payRate === null) {
    missing.add("pay_rate");
    return { ...empty, missing: Array.from(missing) };
  }

  const rateInput = {
    unit: payRate.unit,
    amount: payRate.amount,
    standardDaysPerMonth,
    standardHoursPerDay,
  };
  const daily = toDailyRate(rateInput);
  const hourly = toHourlyRate(rateInput);
  if (daily.missing !== null) missing.add(daily.missing);
  if (hourly.missing !== null) missing.add(hourly.missing);

  const dailyRate = daily.value;
  const hourlyRate = hourly.value;

  /* ------------------------------------------------------------------ */
  /* Luong goc — theo GIO THUC TE hay theo NGAY CONG                      */
  /* ------------------------------------------------------------------ */
  /**
   * HAI DUONG DAN TOI "tra theo gio thuc te", va ca hai deu la mot y dinh
   * duoc khai ro chu khong phai suy doan:
   *
   *   1. Doanh nghiep chon che do `daily_hours` (D-39) — khong co ca, mot
   *      cong tinh bang so gio chuan.
   *   2. NGUOI NAY KHAI LUONG THEO GIO. Khai lương giờ nghĩa là "trả theo
   *      giờ" — nếu hệ thống vẫn trả theo ngày có mặt thì con số đơn giá giờ
   *      người dùng gõ vào không còn là thứ quyết định tiền của họ.
   *
   * Vi sao dieu (2) phai co: mot doanh nghiep co ca cu the cho khoi van phong
   * VA tra theo gio cho khoi san xuat la chuyen binh thuong, nhung `workMode`
   * la MOT gia tri cho ca doanh nghiep. Truoc thay doi nay, nguoi an luong gio
   * o che do `shift` duoc tra `so ngay co mat x (don gia gio x so gio chuan)`
   * — tuc la lam 4 tieng hay 12 tieng trong mot ngay deu ra cung mot so tien,
   * va do dai ca that cua ho khong tham gia vao phep tinh.
   */
  const paysByActualHours = workMode === "daily_hours" || payRate.unit === "hour";

  let basePay: number | null = null;
  if (paysByActualHours) {
    basePay =
      hourlyRate !== null && summary.regularMinutes !== null
        ? hourlyRate * (summary.regularMinutes / 60)
        : null;
  } else {
    basePay =
      dailyRate !== null && summary.creditedDays !== null
        ? dailyRate * summary.creditedDays
        : null;
  }

  /* ------------------------------------------------------------------ */
  /* Cong/tru theo gio thuc te — CHI o `shift_hourly`                     */
  /* ------------------------------------------------------------------ */
  // `hourDeltaMinutes` AM khi thieu gio, nen phep nhan tu ra mot so am; khong
  // co nhanh rieng nao cho "thieu gio" va do la co y — mot nhanh rieng se la
  // mot cho de dau cong bi viet nham thanh dau tru.
  let hourAdjustment: number | null = 0;
  // `paysByActualHours` bi loai TUYET DOI o day: luong goc cua ho da bam dung
  // gio thuc te roi, cong them phan lech gio so voi ca nua la tinh HAI LAN
  // cung mot so gio — mot lan o `basePay`, mot lan o day.
  if (workMode === "shift_hourly" && !paysByActualHours) {
    hourAdjustment =
      hourlyRate !== null ? hourlyRate * (summary.hourDeltaMinutes / 60) : null;
  }

  /* ------------------------------------------------------------------ */
  /* Tien tang ca                                                         */
  /* ------------------------------------------------------------------ */
  /**
   * HAI DUONG, va duong nao duoc dung la do CHINH NGUOI DO co muc rieng hay
   * khong (migration 0026):
   *
   *   KHONG co muc rieng — duong cu, quy tac (1): NHAN `convertedOvertimeHours`
   *   cua Phase 4 voi don gia gio. He so theo loai ngay (thuong/nghi/le) va phu
   *   cap dem da duoc ap o tang tren, khong tinh lai o day.
   *
   *   CO muc rieng — muc do THAY CHO toan bo he so theo loai ngay, nen
   *   `convertedOvertimeHours` (da nhan he so doanh nghiep) khong con dung
   *   duoc: phai quay ve SO PHUT TANG CA THO. Do la ly do `overtimeMinutes` co
   *   mat trong dau vao cua ham nay.
   *
   * `fixed_hourly` la so tien, nen no KHONG nhan voi don gia gio — va vi vay
   * mot nguoi khai muc tien co dinh van tinh duoc tien tang ca ngay ca khi
   * doanh nghiep chua khai he so nao.
   */
  const overtimeHours = summary.overtimeMinutes / 60;
  let overtimePay: number | null;
  if (overtimeRate === null) {
    overtimePay =
      hourlyRate !== null && summary.convertedOvertimeHours !== null
        ? hourlyRate * summary.convertedOvertimeHours
        : null;
  } else if (overtimeRate.valueType === "fixed_hourly") {
    overtimePay = overtimeHours * overtimeRate.value;
  } else {
    overtimePay =
      hourlyRate !== null ? hourlyRate * overtimeHours * overtimeRate.value : null;
  }

  /* ------------------------------------------------------------------ */
  /* Phu cap va khau tru                                                  */
  /* ------------------------------------------------------------------ */
  const allowanceItems: PayrollAdjustmentLine[] = [];
  const deductionItems: PayrollAdjustmentLine[] = [];
  // Tong cua cac dong DA LAM TRON — xem quy tac (3). Cong tu cac o hien ra la
  // thu lam bang luong doi chieu duoc; phep nhan sinh ra tung o thi van chinh
  // xac tuyet doi.
  let allowanceSum = 0;
  let deductionSum = 0;
  let adjustmentUncomputable = false;

  for (const adjustment of adjustments) {
    if (!adjustment.isActive) continue;
    if (!isTargeted({ employee, scopes: adjustment.scopes })) continue;

    // `per_late` nhan voi SO LAN di muon he thong da dem (D-41). Khong lan nao
    // thi khoan do bang 0 — day KHONG phai mot gia tri thieu, no la mot su
    // that ("thang nay ho khong di muon lan nao").
    const multiplier =
      adjustment.basis === "per_late" ? summary.lateCount : 1;

    let unitValue: number | null;
    if (adjustment.valueType === "fixed_amount") {
      unitValue = adjustment.value;
    } else {
      // "% LUONG NGAY", khong phai luong thang — xem comment cua cot
      // `value_type` o migration 0023.
      unitValue = dailyRate !== null ? (adjustment.value / 100) * dailyRate : null;
    }

    if (unitValue === null) {
      // Khoan nay khong quy ra tien duoc vi thieu don gia ngay. Ly do da nam
      // trong `missing` (tu `toDailyRate`); o day chi ghi nhan la TONG khong
      // con day du.
      adjustmentUncomputable = true;
      continue;
    }

    // `unitValue * multiplier` la buoc TRUNG GIAN cuoi cung — no khong bi lam
    // tron. Con so o duoi la CON SO CUOI cua dong nay, lam tron dung mot lan.
    const amount = roundToDong(unitValue * multiplier);
    const line: PayrollAdjustmentLine = {
      adjustmentId: adjustment.id,
      name: adjustment.name,
      amount,
      multiplier,
    };

    if (adjustment.kind === "allowance") {
      allowanceItems.push(line);
      allowanceSum += amount;
    } else {
      deductionItems.push(line);
      deductionSum += amount;
    }
  }

  // Tong BANG DUNG tong cac dong hien ra — ca hai deu la so nguyen, nen day la
  // mot dang thuc chinh xac, khong phai mot xap xi.
  const allowanceTotal = adjustmentUncomputable ? null : allowanceSum;
  const deductionTotal = adjustmentUncomputable ? null : deductionSum;

  /* ------------------------------------------------------------------ */
  /* Thuc nhan — quy tac (2) va (3)                                       */
  /* ------------------------------------------------------------------ */
  // Ba con so cuoi, moi con so lam tron DUNG MOT LAN tu gia tri chinh xac cua
  // no. Tu day tro di khong con phep nhan nao — chi con phep cong so nguyen.
  const basePayFinal = basePay === null ? null : roundToDong(basePay);
  const overtimePayFinal = overtimePay === null ? null : roundToDong(overtimePay);
  const hourAdjustmentFinal =
    hourAdjustment === null ? null : roundToDong(hourAdjustment);

  // BAT KY phan nao `null` thi `netPay` cung `null`. Khong cong phan da biet
  // lai roi trinh bay nhu mot con so day du (quy tac (2)).
  const netPay =
    basePayFinal === null ||
    overtimePayFinal === null ||
    hourAdjustmentFinal === null ||
    allowanceTotal === null ||
    deductionTotal === null
      ? null
      : // Tong cua CHINH nhung o hien ra man hinh — bang luong luon doi chieu
        // duoc (quy tac (3)).
        basePayFinal +
        overtimePayFinal +
        hourAdjustmentFinal +
        allowanceTotal -
        deductionTotal;

  return {
    basePay: basePayFinal,
    overtimePay: overtimePayFinal,
    hourAdjustment: hourAdjustmentFinal,
    allowanceItems,
    deductionItems,
    allowanceTotal,
    deductionTotal,
    netPay,
    missing: Array.from(missing),
  };
}
