import {
  computeDailyLines,
  sumDailyPay,
  type DailyPayLine,
  type DailyPaySource,
  type PayrollMissingInput,
} from "@/lib/payroll/compute-daily";
import { toDailyRate, toHourlyRate } from "@/lib/payroll/rate";
import { isTargeted, type ScopeEmployee } from "@/lib/payroll/scope";
import type {
  EmployeeOvertimeRate,
  PayAdjustment,
  PayRate,
  WorkMode,
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
 *   CON SO CUOI = tung o hien ra man hinh. Moi o duoc lam tron DUNG MOT LAN tu
 *   gia tri chinh xac cua no, va moi tong la tong cua chinh nhung o do — nen
 *   bang luong LUON doi chieu duoc, khong bao gio lech mot dong.
 *
 * RANH GIOI DO NAY DA DI XUONG MOT TANG. Tu khi bang luong bung ra duoc theo
 * NGAY, "o hien ra man hinh" gom ca tien cua tung ngay — nen luong goc, tien
 * tang ca va phan lech gio duoc lam tron o MUC NGAY (`compute-daily.ts`), roi
 * so cua ky la TONG cac so ngay do.
 *
 * He qua da duoc chap nhan CO Y THUC: con so cua ky lech vai chuc dong so voi
 * cach nhan mot lan tu so tong. Doi lai, mot nguoi cong 22 dong ngay tren man
 * hinh se ra DUNG con so thang cua ho. Doi ngat lai la mot bang tu mau thuan
 * voi chinh no — thu te hon nhieu, va quan sat duoc ngay.
 *
 * Day cung la nguyen tac ma `allowanceTotal` von da dung: no la tong cua cac
 * dong khoan DA LAM TRON, khong phai lam tron cua tong chinh xac.
 */

/**
 * Moi ly do khien mot dong luong khong ra duoc con so.
 *
 * Dinh nghia nam o `compute-daily.ts` (file nay import GIA TRI tu do, nen dat
 * kieu o day se tao mot vong import). Xuat lai tu day de moi noi dang import
 * `PayrollMissingInput` tu `compute.ts` khong phai doi.
 */
export type { PayrollMissingInput };

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
  /**
   * So lieu cua ky KHONG suy duoc tu tung ngay. Hien chi con MOT truong: so
   * lan di muon, dung lam he so cho khoan `per_late`.
   *
   * Moi thu khac da chuyen xuong `days` — day la thay doi lam cho tong cua ky
   * LUON bang tong cac dong ngay.
   */
  summary: { lateCount: number };
  /**
   * SO LIEU CONG THEO NGAY — nguon duy nhat cua ba con so tien. Ham nay tu quy
   * chung ra tien qua `computeDailyLines()`, thay vi nhan tham so da quy san:
   * phep quy doi don gia (`toDailyRate`/`toHourlyRate`) chi duoc chay o MOT
   * cho, va do la o day.
   */
  days: readonly DailyPaySource[];
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
  /**
   * Cac dong NGAY da quy ra tien. Ba con so tien o tren la tong cua chung, nen
   * man hinh doi chieu duoc ma khong phai tinh lai gi.
   */
  days: DailyPayLine[];
  missing: PayrollMissingInput[];
}

/** Lam tron TOI DONG, nua len (D-42a). Duoc goi o dung hai cho: dong khoan va netPay. */
function roundToDong(value: number): number {
  return Math.round(value);
}

export function computePayrollLine({
  summary,
  days,
  payRate,
  overtimeRate,
  workMode,
  standardDaysPerMonth,
  standardHoursPerDay,
  adjustments,
  employee,
}: PayrollComputeInput): PayrollLine {
  const missing = new Set<PayrollMissingInput>();

  const empty: PayrollLine = {
    basePay: null,
    overtimePay: null,
    hourAdjustment: null,
    allowanceItems: [],
    deductionItems: [],
    allowanceTotal: null,
    deductionTotal: null,
    netPay: null,
    days: [],
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
  // MOT CHO DUY NHAT quy muc luong ra don gia — hai don gia nay duoc dung cho
  // ca cac dong ngay (qua `computeDailyLines`) lan cac khoan tinh theo % luong
  // ngay. Quy doi o hai noi la mo duong cho hai con so khac nhau.
  const dailyRateResult = toDailyRate(rateInput);
  const hourlyRateResult = toHourlyRate(rateInput);
  if (dailyRateResult.missing !== null) missing.add(dailyRateResult.missing);
  if (hourlyRateResult.missing !== null) missing.add(hourlyRateResult.missing);

  const dailyRate = dailyRateResult.value;
  const hourlyRate = hourlyRateResult.value;

  /* ------------------------------------------------------------------ */
  /* Ba con so tien — CONG tu cac dong NGAY, khong nhan tu so tong        */
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
   * Dieu kien nay khong doi trong mot ky, nen no duoc tinh MOT LAN o day roi
   * truyen xuong moi ngay — khong ngay nao tu suy lai no.
   */
  const paysByActualHours = workMode === "daily_hours" || payRate.unit === "hour";

  // Ba phep nhan cu (don gia ngay x ngay cong, don gia gio x gio quy doi, don
  // gia gio x lech gio) da chuyen xuong `compute-daily.ts` va chay MOT LAN CHO
  // MOI NGAY. Tu day tro di o khoi nay chi con phep cong so nguyen.
  const dailyLines = computeDailyLines({
    days,
    rates: { dailyRate, hourlyRate, overtimeRate, workMode, paysByActualHours },
  });
  const daily = sumDailyPay(dailyLines);
  // Thieu he so tang ca (D-26) va thieu mau so quy doi ngay cong (D-38) den tu
  // tung ngay; chung duoc mang len nguyen ven, khong bi nuot.
  for (const key of daily.missing) missing.add(key);

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
  // Ba con so cuoi da duoc lam tron o MUC NGAY roi cong lai; o day khong lam
  // tron them lan nao. Tu day tro di khong con phep nhan nao — chi con phep
  // cong so nguyen.

  // BAT KY phan nao `null` thi `netPay` cung `null`. Khong cong phan da biet
  // lai roi trinh bay nhu mot con so day du (quy tac (2)).
  const netPay =
    daily.basePay === null ||
    daily.overtimePay === null ||
    daily.hourAdjustment === null ||
    allowanceTotal === null ||
    deductionTotal === null
      ? null
      : // Tong cua CHINH nhung o hien ra man hinh — bang luong luon doi chieu
        // duoc (quy tac (3)), va tu plan nay dieu do dung xuong den TUNG NGAY.
        daily.basePay +
        daily.overtimePay +
        daily.hourAdjustment +
        allowanceTotal -
        deductionTotal;

  return {
    basePay: daily.basePay,
    overtimePay: daily.overtimePay,
    hourAdjustment: daily.hourAdjustment,
    allowanceItems,
    deductionItems,
    allowanceTotal,
    deductionTotal,
    netPay,
    days: dailyLines,
    missing: Array.from(missing),
  };
}
