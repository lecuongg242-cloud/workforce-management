import { describe, expect, it } from "vitest";

import {
  computePayrollLine,
  type PayrollComputeInput,
} from "@/lib/payroll/compute";
import type { PayAdjustment } from "@/lib/types/domain";

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

function line(overrides: {
  summary?: Partial<PayrollComputeInput["summary"]>;
  payRate?: PayrollComputeInput["payRate"];
  workMode?: PayrollComputeInput["workMode"];
  standardDaysPerMonth?: number | null;
  standardHoursPerDay?: number | null;
  adjustments?: PayAdjustment[];
} = {}) {
  return computePayrollLine({
    summary: {
      creditedDays: 26,
      regularMinutes: 26 * 8 * 60,
      hourDeltaMinutes: 0,
      convertedOvertimeHours: 0,
      missingMultiplierKeys: [],
      missingWorkModeInputs: [],
      lateCount: 0,
      ...overrides.summary,
    },
    payRate:
      overrides.payRate === undefined
        ? { unit: "month", amount: MONTHLY_SALARY }
        : overrides.payRate,
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
});
