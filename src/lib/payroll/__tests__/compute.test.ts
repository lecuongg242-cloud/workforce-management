import { describe, expect, it } from "vitest";

import {
  computePayrollLine,
  type PayrollComputeInput,
} from "@/lib/payroll/compute";
import type { DailyPaySource } from "@/lib/payroll/compute-daily";
import type { OvertimeRuleKey, PayAdjustment } from "@/lib/types/domain";

/**
 * Phep tinh ra TIEN (PAY-01).
 *
 * MOI CON SO KY VONG TRONG FILE NAY DUOC TINH TAY VA GHI RA THANH CONG THUC
 * ngay tren dong khang dinh. Do khong phai trang tri: mot test luong ma con so
 * ky vong duoc chep tu ket qua chay lan dau thi no khong chung minh gi ca — no
 * chi khang dinh rang ma nguon van lam dung viec no dang lam.
 *
 * Bo so dung xuyen file: luong thang **13.000.000**, **26** ngay cong chuan,
 * **8** gio/ngay.
 *   -> don gia ngay = 13.000.000 / 26 = 500.000
 *   -> don gia gio  = 500.000 / 8    = 62.500
 */

const DAYS_PER_MONTH = 26;
const HOURS_PER_DAY = 8;
const MONTHLY_SALARY = 13_000_000;
const DAILY_RATE = 500_000;
const HOURLY_RATE = 62_500;

const EMPLOYEE = {
  id: "nv-1",
  departmentId: "dept-a",
  position: "Nhân viên kho",
};

function adjustment(overrides: Partial<PayAdjustment> = {}): PayAdjustment {
  return {
    id: "adj-1",
    companyId: "cty-01",
    name: "Phụ cấp ăn trưa",
    kind: "allowance",
    valueType: "fixed_amount",
    value: 730_000,
    basis: "per_period",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    scopes: [
      {
        id: "sc-1",
        companyId: "cty-01",
        adjustmentId: "adj-1",
        mode: "include",
        scopeType: "company",
        scopeValue: null,
      },
    ],
    ...overrides,
  };
}

/**
 * SO LIEU CONG CUA CA KY, gop lai thanh MOT ngay tong hop.
 *
 * Vi sao mot ngay chu khong phai N ngay: phep tinh tien la TUYEN TINH theo
 * ngay cong / so phut / gio quy doi, nen mot ngay mang so tong cho ra DUNG con
 * so ma cong thuc cu (nhan tu so tong) cho ra. Nho vay 33 bai duoi day giu
 * NGUYEN moi con so ky vong da co, va chung tro thanh bo hoi quy chung minh
 * rang viec chuyen sang cong-tu-ngay KHONG lam doi so hoc.
 *
 * Cac bai can nhieu ngay THAT (lam tron o muc ngay, ngay dang do) truyen
 * `days` tuong minh — xem `describe` cuoi file.
 */
interface AggregateSummary {
  creditedDays: number | null;
  regularMinutes: number | null;
  hourDeltaMinutes: number;
  convertedOvertimeHours: number | null;
  overtimeMinutes: number;
  missingMultiplierKeys: OvertimeRuleKey[];
  missingWorkModeInputs: Array<"standard_hours_per_day">;
  lateCount: number;
}

function aggregateDay(summary: AggregateSummary): DailyPaySource {
  return {
    date: "2026-08-03",
    status: "on_time",
    hasOpenPunch: false,
    credit: {
      creditedDays: summary.creditedDays,
      regularMinutes: summary.regularMinutes,
      overtimeMinutes: summary.overtimeMinutes,
      hourDelta: summary.hourDeltaMinutes,
      missing: summary.missingWorkModeInputs[0] ?? null,
    },
    classification: {
      dayType: "weekday",
      nightMinutes: 0,
      overtimeMinutes: summary.overtimeMinutes,
      overtimeNightMinutes: 0,
      convertedOvertimeHours: summary.convertedOvertimeHours,
      missingMultiplierKeys: summary.missingMultiplierKeys,
      // Bo kiem cua file nay noi ve TONG cua ky; phan chia theo luot co bo
      // kiem rieng o `compute-daily.test.ts`.
      punches: [],
      workModeInputMissing: summary.missingWorkModeInputs.length > 0,
    },
  };
}

function line(overrides: {
  summary?: Partial<AggregateSummary>;
  days?: DailyPaySource[];
  payRate?: PayrollComputeInput["payRate"];
  overtimeRate?: PayrollComputeInput["overtimeRate"];
  workMode?: PayrollComputeInput["workMode"];
  standardDaysPerMonth?: number | null;
  standardHoursPerDay?: number | null;
  adjustments?: PayAdjustment[];
} = {}) {
  const summary: AggregateSummary = {
    creditedDays: 26,
    regularMinutes: 26 * 8 * 60,
    hourDeltaMinutes: 0,
    convertedOvertimeHours: 0,
    overtimeMinutes: 0,
    missingMultiplierKeys: [],
    missingWorkModeInputs: [],
    lateCount: 0,
    ...overrides.summary,
  };

  return computePayrollLine({
    summary: { lateCount: summary.lateCount },
    days: overrides.days ?? [aggregateDay(summary)],
    payRate:
      overrides.payRate === undefined
        ? { unit: "month", amount: MONTHLY_SALARY }
        : overrides.payRate,
    overtimeRate: overrides.overtimeRate ?? null,
    workMode: overrides.workMode ?? "shift",
    standardDaysPerMonth:
      overrides.standardDaysPerMonth === undefined
        ? DAYS_PER_MONTH
        : overrides.standardDaysPerMonth,
    standardHoursPerDay:
      overrides.standardHoursPerDay === undefined
        ? HOURS_PER_DAY
        : overrides.standardHoursPerDay,
    adjustments: overrides.adjustments ?? [],
    employee: EMPLOYEE,
  });
}

describe("Lương gốc theo từng chế độ tính công", () => {
  it("1. `shift` — đơn giá NGÀY × ngày công", () => {
    // 500.000 x 22 = 11.000.000
    const result = line({ summary: { creditedDays: 22 } });

    expect(result.basePay).toBe(DAILY_RATE * 22);
    expect(result.basePay).toBe(11_000_000);
    expect(result.netPay).toBe(11_000_000);
  });

  it("2. `daily_hours` — đơn giá GIỜ × số giờ thường thực tế (D-39)", () => {
    // Lam 6 tieng x 20 ngay = 7.200 phut = 120 gio; 62.500 x 120 = 7.500.000
    const result = line({
      workMode: "daily_hours",
      summary: { regularMinutes: 7_200, creditedDays: 12 },
    });

    expect(result.basePay).toBe(HOURLY_RATE * 120);
    expect(result.basePay).toBe(7_500_000);
  });

  it("3. `daily_hours` KHÔNG dùng `creditedDays` để tính lương gốc", () => {
    // Doi `creditedDays` ma khong doi `regularMinutes` -> luong goc khong doi.
    const a = line({ workMode: "daily_hours", summary: { regularMinutes: 7_200, creditedDays: 12 } });
    const b = line({ workMode: "daily_hours", summary: { regularMinutes: 7_200, creditedDays: 26 } });

    expect(a.basePay).toBe(b.basePay);
  });

  it("4. `shift_hourly` — đơn giá NGÀY × ngày công, CỘNG thêm phần lệch giờ", () => {
    // 500.000 x 22 = 11.000.000 ; thua 240 phut = 4 gio -> 62.500 x 4 = 250.000
    const result = line({
      workMode: "shift_hourly",
      summary: { creditedDays: 22, hourDeltaMinutes: 240 },
    });

    expect(result.basePay).toBe(11_000_000);
    expect(result.hourAdjustment).toBe(250_000);
    expect(result.netPay).toBe(11_250_000);
  });

  it("5. `shift_hourly` THIẾU GIỜ -> `hourAdjustment` ÂM và thực nhận giảm", () => {
    // Thieu 120 phut = 2 gio -> 62.500 x (-2) = -125.000
    const result = line({
      workMode: "shift_hourly",
      summary: { creditedDays: 22, hourDeltaMinutes: -120 },
    });

    expect(result.hourAdjustment).toBe(-125_000);
    expect(result.netPay).toBe(11_000_000 - 125_000);
  });

  it("6. `shift` và `shift_hourly` KHÔNG cho cùng kết quả khi có lệch giờ", () => {
    const shift = line({ summary: { creditedDays: 22, hourDeltaMinutes: -120 } });
    const shiftHourly = line({
      workMode: "shift_hourly",
      summary: { creditedDays: 22, hourDeltaMinutes: -120 },
    });

    // O `shift`, do lech gio khong anh huong tien — do la dinh nghia cua che do.
    expect(shift.netPay).toBe(11_000_000);
    expect(shiftHourly.netPay).toBe(10_875_000);
  });
});

describe("Tiền tăng ca — NHÂN giờ quy đổi của Phase 4, không tính lại (D-31)", () => {
  it("7. giờ quy đổi × đơn giá giờ", () => {
    // 62.500 x 12,75 = 796.875
    const result = line({
      summary: { creditedDays: 22, convertedOvertimeHours: 12.75 },
    });

    expect(result.overtimePay).toBe(796_875);
    expect(result.netPay).toBe(11_000_000 + 796_875);
  });

  it("8. THIẾU HỆ SỐ -> tiền tăng ca `null` VÀ thực nhận `null` (D-26, quy tắc (2))", () => {
    const result = line({
      summary: {
        creditedDays: 22,
        convertedOvertimeHours: null,
        missingMultiplierKeys: ["weekday"],
      },
    });

    expect(result.overtimePay).toBeNull();
    // Cong phan da biet (11.000.000) roi trinh bay nhu mot con so day du la
    // cach tao ra mot con so SAI ma trong hoan toan dung.
    expect(result.netPay).toBeNull();
    expect(result.netPay).not.toBe(11_000_000);
    expect(result.missing).toContain("overtime_rule:weekday");
    // Luong goc VAN tinh duoc va van duoc hien — chi tong la khong.
    expect(result.basePay).toBe(11_000_000);
  });
});

describe("Thiếu dữ kiện -> `null` kèm lý do, KHÔNG BAO GIỜ 0 (quy tắc (2))", () => {
  it("9. chưa khai mức lương -> mọi con số `null`, `missing` mang `pay_rate`", () => {
    const result = line({ payRate: null, adjustments: [adjustment()] });

    expect(result.basePay).toBeNull();
    expect(result.netPay).toBeNull();
    expect(result.basePay).not.toBe(0);
    expect(result.netPay).not.toBe(0);
    expect(result.missing).toEqual(["pay_rate"]);
    // Ke ca khoan `fixed_amount` (von khong phu thuoc luong) cung khong hien:
    // mot phan cua bang luong doc ra thanh "day la tat ca nhung gi ho duoc tra".
    expect(result.allowanceItems).toEqual([]);
  });

  it("10. thiếu mẫu số quy đổi -> `null` kèm khoá mẫu số thiếu", () => {
    const result = line({ standardDaysPerMonth: null });

    expect(result.basePay).toBeNull();
    expect(result.netPay).toBeNull();
    expect(result.missing).toContain("standard_days_per_month");
  });

  it("11. thiếu mẫu số ngày công của chế độ (D-38) được mang xuống nguyên vẹn", () => {
    const result = line({
      workMode: "daily_hours",
      summary: {
        creditedDays: null,
        regularMinutes: null,
        missingWorkModeInputs: ["standard_hours_per_day"],
      },
      standardHoursPerDay: null,
    });

    expect(result.netPay).toBeNull();
    expect(result.missing).toContain("standard_hours_per_day");
  });

  it("12. lương GIỜ không cần `standardDaysPerMonth` — vẫn ra tiền dù mẫu số đó chưa khai", () => {
    // 60.000/gio, lam 160 gio thuong -> 9.600.000
    const result = line({
      workMode: "daily_hours",
      payRate: { unit: "hour", amount: 60_000 },
      standardDaysPerMonth: null,
      summary: { regularMinutes: 9_600, creditedDays: 20 },
    });

    expect(result.basePay).toBe(9_600_000);
    expect(result.netPay).toBe(9_600_000);
    expect(result.missing).toEqual([]);
  });
});

describe("Phụ cấp và khấu trừ", () => {
  it("13. khoản `fixed_amount` cộng đúng số tiền đã khai", () => {
    const result = line({
      summary: { creditedDays: 22 },
      adjustments: [adjustment()],
    });

    expect(result.allowanceItems.length).toBe(1);
    expect(result.allowanceItems[0].amount).toBe(730_000);
    expect(result.allowanceTotal).toBe(730_000);
    expect(result.netPay).toBe(11_000_000 + 730_000);
  });

  it("14. `percent_of_daily_wage` tính trên LƯƠNG NGÀY, không phải lương tháng", () => {
    // 10% x 500.000 = 50.000. Neu tinh nham tren luong thang se ra 1.300.000.
    const result = line({
      summary: { creditedDays: 22 },
      adjustments: [
        adjustment({ valueType: "percent_of_daily_wage", value: 10 }),
      ],
    });

    expect(result.allowanceTotal).toBe(50_000);
    expect(result.allowanceTotal).not.toBe(1_300_000);
  });

  it("15. phạt `per_late` nhân với SỐ LẦN đi muộn (D-41)", () => {
    // 100.000 x 3 lan = 300.000, TRU khoi thuc nhan.
    const result = line({
      summary: { creditedDays: 22, lateCount: 3 },
      adjustments: [
        adjustment({
          name: "Phạt đi muộn",
          kind: "deduction",
          basis: "per_late",
          value: 100_000,
        }),
      ],
    });

    expect(result.deductionItems[0].multiplier).toBe(3);
    expect(result.deductionItems[0].amount).toBe(300_000);
    expect(result.netPay).toBe(11_000_000 - 300_000);
  });

  it("16. không đi muộn lần nào -> khoản `per_late` bằng 0, và đó là một SỰ THẬT chứ không phải thiếu dữ kiện", () => {
    const result = line({
      summary: { creditedDays: 22, lateCount: 0 },
      adjustments: [
        adjustment({ kind: "deduction", basis: "per_late", value: 100_000 }),
      ],
    });

    expect(result.deductionTotal).toBe(0);
    expect(result.netPay).toBe(11_000_000);
    expect(result.missing).toEqual([]);
  });

  it("17. khoản ĐÃ TẮT không được áp", () => {
    const result = line({
      summary: { creditedDays: 22 },
      adjustments: [adjustment({ isActive: false })],
    });

    expect(result.allowanceItems).toEqual([]);
    expect(result.netPay).toBe(11_000_000);
  });

  it("18. khoản NGOÀI PHẠM VI của người này không được áp", () => {
    const result = line({
      summary: { creditedDays: 22 },
      adjustments: [
        adjustment({
          scopes: [
            {
              id: "sc-x",
              companyId: "cty-01",
              adjustmentId: "adj-1",
              mode: "include",
              scopeType: "department",
              scopeValue: "dept-khac",
            },
          ],
        }),
      ],
    });

    expect(result.allowanceItems).toEqual([]);
  });

  it("19. cộng phụ cấp và trừ khấu trừ trong cùng một dòng lương", () => {
    const result = line({
      summary: { creditedDays: 22, lateCount: 2 },
      adjustments: [
        adjustment({ id: "adj-a", name: "Phụ cấp ăn trưa", value: 730_000 }),
        adjustment({
          id: "adj-b",
          name: "Phạt đi muộn",
          kind: "deduction",
          basis: "per_late",
          value: 50_000,
        }),
      ],
    });

    // 11.000.000 + 730.000 - (50.000 x 2) = 11.630.000
    expect(result.allowanceTotal).toBe(730_000);
    expect(result.deductionTotal).toBe(100_000);
    expect(result.netPay).toBe(11_630_000);
  });
});

describe("Làm tròn — không ở bước trung gian, và bảng luôn đối chiếu được (D-42a)", () => {
  it("20. ĐƠN GIÁ KHÔNG bị làm tròn: bộ số cố ý chia không hết vẫn ra lương gốc tròn", () => {
    // 10.000.000 / 26 = 384.615,3846.../ngay — mot don gia chia khong het.
    // Neu don gia bi lam tron ve 384.615 truoc khi nhan, luong goc se ra
    // 384.615 x 26 = 9.999.990 — HUT 10 dong so voi chinh muc luong da khai.
    const result = line({
      payRate: { unit: "month", amount: 10_000_000 },
      summary: { creditedDays: 26 },
    });

    expect(result.basePay).toBe(10_000_000);
    expect(result.basePay).not.toBe(9_999_990);
  });

  it("21. TỔNG KHOẢN BẰNG ĐÚNG TỔNG CÁC DÒNG, trên một bộ số cố ý gây lệch làm tròn", () => {
    // Ba khoan, moi khoan 33,333% cua 384.615,3846... = 128.203,84...
    // -> moi dong lam tron thanh 128.204; ba dong = 384.612.
    // Gia tri chinh xac cua tong la 384.611,53... — lam tron ra 384.612 o bo
    // so nay, nhung o mot bo so khac hai cach se lech nhau mot dong. Khang
    // dinh o day la DANG THUC, khong phai mot su trung hop: tong duoc dinh
    // nghia LA tong cac dong (xem quy tac (3) cua compute.ts).
    const percent = adjustment({ valueType: "percent_of_daily_wage", value: 33.333 });
    const result = line({
      payRate: { unit: "month", amount: 10_000_000 },
      summary: { creditedDays: 26 },
      adjustments: [
        { ...percent, id: "p1", name: "Khoản A" },
        { ...percent, id: "p2", name: "Khoản B" },
        { ...percent, id: "p3", name: "Khoản C" },
      ],
    });

    const sumOfLines = result.allowanceItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    expect(result.allowanceItems.length).toBe(3);
    expect(result.allowanceItems[0].amount).toBe(128_204);
    expect(result.allowanceTotal).toBe(sumOfLines);
  });

  it("22. THỰC NHẬN BẰNG ĐÚNG tổng các ô hiển thị — kế toán đối chiếu không lệch một đồng", () => {
    const percent = adjustment({ valueType: "percent_of_daily_wage", value: 33.333 });
    const result = line({
      payRate: { unit: "month", amount: 10_000_000 },
      workMode: "shift_hourly",
      summary: {
        creditedDays: 26,
        hourDeltaMinutes: -77,
        convertedOvertimeHours: 3.33,
        lateCount: 2,
      },
      adjustments: [
        { ...percent, id: "p1", name: "Khoản A" },
        {
          ...adjustment({
            id: "p2",
            name: "Phạt đi muộn",
            kind: "deduction",
            basis: "per_late",
            valueType: "percent_of_daily_wage",
            value: 7.77,
          }),
        },
      ],
    });

    expect(result.netPay).toBe(
      (result.basePay as number) +
        (result.overtimePay as number) +
        (result.hourAdjustment as number) +
        (result.allowanceTotal as number) -
        (result.deductionTotal as number),
    );
  });

  it("23. mọi số tiền trả về là SỐ NGUYÊN — làm tròn tới đồng (D-42a)", () => {
    const result = line({
      payRate: { unit: "month", amount: 10_000_000 },
      summary: { creditedDays: 21, convertedOvertimeHours: 3.33 },
      adjustments: [adjustment({ valueType: "percent_of_daily_wage", value: 7.5 })],
    });

    for (const value of [
      result.basePay,
      result.overtimePay,
      result.allowanceTotal,
      result.netPay,
    ]) {
      expect(value).not.toBeNull();
      expect(Number.isInteger(value as number)).toBe(true);
    }
  });
  /**
   * KHAI LUONG GIO => TRA THEO GIO THUC TE, o MOI che do tinh cong.
   *
   * Ba bai duoi day la hoi quy cho mot loi TRA SAI TIEN co that: mot doanh
   * nghiep co ca cu the (`shift`) cho khoi van phong va tra theo gio cho khoi
   * san xuat thi truoc day nguoi an luong gio duoc tra
   * `so ngay co mat x (don gia gio x so gio chuan)` — lam 4 tieng hay 12
   * tieng trong mot ngay deu ra cung mot so tien.
   *
   * Bo so: luong gio 55.000; ca dai 7,25 gio; 27 ngay lam; 195,75 gio thuong.
   */
  const HOURLY_WAGE = 55_000;
  const REGULAR_MINUTES = Math.round(195.75 * 60); // 11.745 phut

  it("24. `shift` + khai LƯƠNG GIỜ -> trả theo giờ thực tế, KHÔNG theo ngày công", () => {
    // 55.000 x 195,75 = 10.766.250 (khong phai 27 x (55.000 x 8) = 11.880.000)
    const result = line({
      workMode: "shift",
      payRate: { unit: "hour", amount: HOURLY_WAGE },
      summary: { creditedDays: 27, regularMinutes: REGULAR_MINUTES },
    });

    expect(result.basePay).toBe(10_766_250);
    expect(result.basePay).not.toBe(27 * (HOURLY_WAGE * HOURS_PER_DAY));
  });

  it("25. `shift` + khai LƯƠNG GIỜ -> đổi ngày công mà giữ nguyên giờ thì lương gốc KHÔNG đổi", () => {
    const a = line({
      workMode: "shift",
      payRate: { unit: "hour", amount: HOURLY_WAGE },
      summary: { creditedDays: 27, regularMinutes: REGULAR_MINUTES },
    });
    const b = line({
      workMode: "shift",
      payRate: { unit: "hour", amount: HOURLY_WAGE },
      summary: { creditedDays: 20, regularMinutes: REGULAR_MINUTES },
    });

    expect(a.basePay).toBe(b.basePay);
  });

  it("26. `shift_hourly` + khai LƯƠNG GIỜ -> KHÔNG cộng lệch giờ lần thứ hai", () => {
    // Luong goc da bam gio thuc te; cong them hourDelta nua la tinh hai lan
    // cung mot so gio.
    const result = line({
      workMode: "shift_hourly",
      payRate: { unit: "hour", amount: HOURLY_WAGE },
      summary: {
        creditedDays: 27,
        regularMinutes: REGULAR_MINUTES,
        hourDeltaMinutes: -240,
      },
    });

    expect(result.hourAdjustment).toBe(0);
    expect(result.basePay).toBe(10_766_250);
  });

  it("27. khai LƯƠNG THÁNG -> vẫn tính theo ngày công như cũ (không đổi hành vi cũ)", () => {
    const result = line({
      workMode: "shift",
      summary: { creditedDays: 22, regularMinutes: 1 },
    });

    expect(result.basePay).toBe(DAILY_RATE * 22);
  });

  it("28. khai LƯƠNG NGÀY -> vẫn tính theo ngày công (đơn vị ngày không phải đơn vị giờ)", () => {
    // 450.000 x 27 = 12.150.000
    const result = line({
      workMode: "shift",
      payRate: { unit: "day", amount: 450_000 },
      summary: { creditedDays: 27, regularMinutes: REGULAR_MINUTES },
    });

    expect(result.basePay).toBe(12_150_000);
  });
  /**
   * MUC TANG CA RIENG CUA MOT NGUOI (migration 0026).
   *
   * Muc rieng THAY CHO toan bo he so theo loai ngay cua doanh nghiep, nen phep
   * tinh phai quay ve SO PHUT TANG CA THO — dung `convertedOvertimeHours` (da
   * nhan he so doanh nghiep) o day la nhan he so hai lan.
   *
   * Bo so: 6 gio tang ca tho (360 phut); don gia gio cua bo so chung = 62.500.
   */
  const OT_MINUTES = 360;

  it("29. khong khai muc rieng -> van nhan `convertedOvertimeHours` voi don gia gio (duong cu)", () => {
    // 62.500 x 9 = 562.500
    const result = line({
      summary: { convertedOvertimeHours: 9, overtimeMinutes: OT_MINUTES },
    });

    expect(result.overtimePay).toBe(562_500);
  });

  it("30. muc rieng SO TIEN 60.000/gio -> 6 gio tang ca = 360.000, khong dinh gi toi don gia gio", () => {
    const result = line({
      overtimeRate: { valueType: "fixed_hourly", value: 60_000 },
      // He so doanh nghiep cho ra 9 gio quy doi — con so nay phai bi BO QUA.
      summary: { convertedOvertimeHours: 9, overtimeMinutes: OT_MINUTES },
    });

    expect(result.overtimePay).toBe(360_000);
  });

  it("31. muc rieng SO TIEN van tinh duoc khi doanh nghiep CHUA khai he so nao", () => {
    // Nguoi co thoa thuan rieng khong bi chan boi mot he so ma ho khong dung.
    const result = line({
      overtimeRate: { valueType: "fixed_hourly", value: 60_000 },
      summary: {
        convertedOvertimeHours: null,
        overtimeMinutes: OT_MINUTES,
        missingMultiplierKeys: ["weekday"],
      },
    });

    expect(result.overtimePay).toBe(360_000);
    expect(result.missing).not.toContain("overtime_rule:weekday");
    expect(result.netPay).not.toBeNull();
  });

  it("32. muc rieng HE SO 2,0 -> 62.500 x 6 gio x 2 = 750.000 (tinh tu phut THO)", () => {
    const result = line({
      overtimeRate: { valueType: "multiplier", value: 2 },
      // 9 gio quy doi cua doanh nghiep phai bi bo qua; neu bi dung nham thi
      // ket qua se la 62.500 x 9 x 2 = 1.125.000.
      summary: { convertedOvertimeHours: 9, overtimeMinutes: OT_MINUTES },
    });

    expect(result.overtimePay).toBe(750_000);
  });

  it("33. muc rieng khong dung toi luong goc — chi doi tien tang ca", () => {
    const withRate = line({
      overtimeRate: { valueType: "fixed_hourly", value: 60_000 },
      summary: { creditedDays: 22, convertedOvertimeHours: 9, overtimeMinutes: OT_MINUTES },
    });
    const withoutRate = line({
      summary: { creditedDays: 22, convertedOvertimeHours: 9, overtimeMinutes: OT_MINUTES },
    });

    expect(withRate.basePay).toBe(withoutRate.basePay);
    expect(withRate.overtimePay).not.toBe(withoutRate.overtimePay);
  });
});

/**
 * TONG CUA KY BANG DUNG TONG CAC DONG NGAY.
 *
 * Day la loi hua ma ca thay doi nay ton tai vi no. Cac bai o tren dung MOT
 * ngay gop nen chung khong cham toi duoc dieu do; nhung bai duoi day dung
 * NHIEU ngay that.
 */
describe("Tổng kỳ bằng đúng tổng các dòng ngày", () => {
  /** Mot ngay thuong du ca: 1 ngay cong, 480 phut thuong. */
  function workDay(date: string): DailyPaySource {
    return {
      date,
      status: "on_time",
      hasOpenPunch: false,
      credit: {
        creditedDays: 1,
        regularMinutes: 480,
        overtimeMinutes: 0,
        hourDelta: 0,
        missing: null,
      },
      classification: {
        dayType: "weekday",
        nightMinutes: 0,
        overtimeMinutes: 0,
        overtimeNightMinutes: 0,
        convertedOvertimeHours: 0,
        missingMultiplierKeys: [],
        punches: [],
        workModeInputMissing: false,
      },
    };
  }

  /** Mot ngay da cham vao, chua cham ra. */
  function openDay(date: string): DailyPaySource {
    return {
      ...workDay(date),
      hasOpenPunch: true,
      credit: {
        creditedDays: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        hourDelta: 0,
        missing: null,
      },
    };
  }

  const days22 = Array.from({ length: 22 }, (_, index) =>
    workDay(`2026-08-${String(index + 1).padStart(2, "0")}`),
  );

  it("34. netPay === Σ dayTotal + phụ cấp − khấu trừ, bằng ĐÚNG chứ không xấp xỉ", () => {
    const result = line({ days: days22, adjustments: [adjustment()] });

    const sumOfDays = result.days.reduce(
      (sum, day) => sum + (day.dayTotal ?? 0),
      0,
    );

    expect(result.days).toHaveLength(22);
    // 500.000 x 22 = 11.000.000
    expect(sumOfDays).toBe(11_000_000);
    expect(result.basePay).toBe(sumOfDays);
    // Dang thuc CHINH XAC — day la thu giu cho ke toan doi chieu bang luong
    // voi chi tiet ngay ma khong lech mot dong.
    expect(result.netPay).toBe(
      sumOfDays +
        (result.allowanceTotal as number) -
        (result.deductionTotal as number),
    );
  });

  it("35. ngày đang dở KHÔNG làm đổi tổng kỳ, và KHÔNG báo thiếu dữ kiện", () => {
    const a = line({ days: days22 });
    const b = line({ days: [...days22, openDay("2026-08-23")] });

    expect(b.netPay).toBe(a.netPay);
    expect(b.missing).toEqual([]);
    // Ngay do VAN co mat trong danh sach — no chi khong mang con so nao.
    expect(b.days).toHaveLength(23);
    expect(b.days[22].state).toBe("in_progress");
    expect(b.days[22].dayTotal).toBeNull();
  });

  it("36. LÀM TRÒN Ở MỨC NGÀY: 26 ngày riêng lẻ lệch vài chục đồng so với một ngày gộp", () => {
    // 10.000.000 / 26 = 384.615,3846.../ngay.
    //   - Mot ngay gop (26 ngay cong):  384.615,3846... x 26 = 10.000.000
    //   - 26 ngay rieng le: moi ngay lam tron thanh 384.615 -> x26 = 9.999.990
    const gop = line({
      payRate: { unit: "month", amount: 10_000_000 },
      summary: { creditedDays: 26 },
    });
    const rieng = line({
      payRate: { unit: "month", amount: 10_000_000 },
      days: Array.from({ length: 26 }, (_, index) =>
        workDay(`2026-08-${String(index + 1).padStart(2, "0")}`),
      ),
    });

    expect(gop.basePay).toBe(10_000_000);
    expect(rieng.basePay).toBe(9_999_990);

    // 10 dong chenh lech nay la DANH DOI DA DUOC CHAP NHAN CO Y THUC, khong
    // phai mot loi. Doi lai: cong 26 dong tren man hinh ra DUNG con so thang.
    const sumOfDays = rieng.days.reduce(
      (sum, day) => sum + (day.dayTotal ?? 0),
      0,
    );
    expect(rieng.basePay).toBe(sumOfDays);
  });
});
