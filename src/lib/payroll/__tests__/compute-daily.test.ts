import { describe, expect, it } from "vitest";

import {
  computeDailyPay,
  sumDailyPay,
  type DailyPayInput,
} from "@/lib/payroll/compute-daily";
import type { DayCredit } from "@/lib/attendance/work-mode";
import type { DayClassification } from "@/lib/attendance/classification-context";

/**
 * Tien cua MOT ngay.
 *
 * MOI CON SO KY VONG TRONG FILE NAY DUOC TINH TAY VA GHI RA THANH CONG THUC
 * ngay tren dong khang dinh — cung khuon `compute.test.ts`. Mot test luong ma
 * con so ky vong duoc chep tu ket qua chay lan dau thi no khong chung minh gi
 * ca.
 *
 * Bo so dung xuyen file: don gia ngay **500.000**, don gia gio **62.500**
 * (luong thang 13.000.000 / 26 ngay chuan / 8 gio).
 */

const DAILY_RATE = 500_000;
const HOURLY_RATE = 62_500;

function credit(overrides: Partial<DayCredit> = {}): DayCredit {
  return {
    creditedDays: 1,
    regularMinutes: 480,
    overtimeMinutes: 0,
    hourDelta: 0,
    missing: null,
    ...overrides,
  };
}

function classification(
  overrides: Partial<DayClassification> = {},
): DayClassification {
  return {
    dayType: "weekday",
    nightMinutes: 0,
    overtimeMinutes: 0,
    overtimeNightMinutes: 0,
    convertedOvertimeHours: 0,
    missingMultiplierKeys: [],
    workModeInputMissing: false,
    ...overrides,
  };
}

function day(overrides: Partial<DailyPayInput> = {}) {
  return computeDailyPay({
    date: "2026-08-03",
    credit: credit(),
    classification: classification(),
    status: "on_time",
    hasOpenPunch: false,
    dailyRate: DAILY_RATE,
    hourlyRate: HOURLY_RATE,
    overtimeRate: null,
    workMode: "shift",
    paysByActualHours: false,
    ...overrides,
  });
}

describe("computeDailyPay", () => {
  it("1. ngay thuong du ca -> luong ngay bang dung don gia ngay", () => {
    const result = day();

    // 500.000 x 1 ngay cong = 500.000
    expect(result.basePay).toBe(500_000);
    expect(result.overtimePay).toBe(0);
    expect(result.hourAdjustment).toBe(0);
    expect(result.dayTotal).toBe(500_000);
    expect(result.state).toBe("counted");
    expect(result.missing).toEqual([]);
  });

  it("2. tang ca 2,25 gio quy doi -> nhan don gia gio, KHONG tinh lai he so", () => {
    const result = day({
      classification: classification({
        overtimeMinutes: 90,
        convertedOvertimeHours: 2.25, // 1,5 gio x he so 1,5 — da quy doi san
      }),
    });

    // 62.500 x 2,25 = 140.625
    expect(result.overtimePay).toBe(140_625);
    // 500.000 + 140.625 + 0 = 640.625
    expect(result.dayTotal).toBe(640_625);
  });

  it("3. luong theo gio thuc te -> luong ngay bam theo regularMinutes", () => {
    const result = day({
      credit: credit({ creditedDays: 0.75, regularMinutes: 360 }),
      paysByActualHours: true,
    });

    // 62.500 x (360 / 60) = 375.000
    expect(result.basePay).toBe(375_000);
  });

  it("4. shift_hourly thieu 30 phut -> hourAdjustment AM", () => {
    const result = day({
      credit: credit({ regularMinutes: 450, hourDelta: -30 }),
      workMode: "shift_hourly",
    });

    // 62.500 x (-30 / 60) = -31.250
    expect(result.hourAdjustment).toBe(-31_250);
    // 500.000 + 0 + (-31.250) = 468.750
    expect(result.dayTotal).toBe(468_750);
  });

  it("5. nghi CO phep -> tron mot ngay cong, khong gio lam", () => {
    const result = day({
      credit: credit({ creditedDays: 1, regularMinutes: 0 }),
      status: "leave_paid",
    });

    expect(result.state).toBe("leave_paid");
    // 500.000 x 1 = 500.000
    expect(result.basePay).toBe(500_000);
    expect(result.dayTotal).toBe(500_000);
  });

  it("6. nghi KHONG phep -> khong dong nao, nhung van la mot dong that", () => {
    const result = day({
      credit: credit({ creditedDays: 0, regularMinutes: 0 }),
      status: "leave_unpaid",
    });

    expect(result.state).toBe("leave_unpaid");
    // 500.000 x 0 = 0 — mot su that, khong phai mot gia tri thieu.
    expect(result.basePay).toBe(0);
    expect(result.dayTotal).toBe(0);
    expect(result.missing).toEqual([]);
  });

  it("7. ngay dang do -> KHONG co so, khong phai so 0", () => {
    const result = day({
      credit: credit({ creditedDays: 0, regularMinutes: 0 }),
      hasOpenPunch: true,
    });

    expect(result.state).toBe("in_progress");
    expect(result.basePay).toBeNull();
    expect(result.dayTotal).toBeNull();
    // KHONG co `missing`: ngay nay khong thieu du kien, no chua ket thuc.
    expect(result.missing).toEqual([]);
  });

  it("8. thieu mau so quy doi -> dayTotal null kem ly do", () => {
    const result = day({
      credit: credit({
        creditedDays: null,
        regularMinutes: null,
        missing: "standard_hours_per_day",
      }),
    });

    expect(result.basePay).toBeNull();
    expect(result.dayTotal).toBeNull();
    expect(result.missing).toContain("standard_hours_per_day");
  });

  it("9. thieu he so tang ca -> chan, TRU KHI nguoi do co muc tang ca rieng", () => {
    const chan = day({
      classification: classification({
        overtimeMinutes: 60,
        convertedOvertimeHours: null,
        missingMultiplierKeys: ["weekday"],
      }),
    });
    expect(chan.overtimePay).toBeNull();
    expect(chan.dayTotal).toBeNull();
    expect(chan.missing).toContain("overtime_rule:weekday");

    const rieng = day({
      classification: classification({
        overtimeMinutes: 60,
        convertedOvertimeHours: null,
        missingMultiplierKeys: ["weekday"],
      }),
      overtimeRate: { valueType: "fixed_hourly", value: 80_000 },
    });
    // 1 gio x 80.000 = 80.000. He so cua doanh nghiep khong tham gia.
    expect(rieng.overtimePay).toBe(80_000);
    expect(rieng.missing).toEqual([]);
  });

  it("10. muc tang ca rieng dang he so -> nhan don gia gio, khong dung gio quy doi", () => {
    const result = day({
      classification: classification({
        overtimeMinutes: 120,
        convertedOvertimeHours: 3,
      }),
      overtimeRate: { valueType: "multiplier", value: 2 },
    });

    // 62.500 x 2 gio x 2,0 = 250.000 (KHONG dung convertedOvertimeHours = 3)
    expect(result.overtimePay).toBe(250_000);
  });

  it("11. chua khai muc luong -> khong con so nao", () => {
    const result = day({ dailyRate: null, hourlyRate: null });

    expect(result.basePay).toBeNull();
    expect(result.overtimePay).toBeNull();
    expect(result.dayTotal).toBeNull();
  });
});

describe("sumDailyPay", () => {
  it("12. tong bang dung tong cac dong DA LAM TRON", () => {
    // 10.000.000 / 26 = 384.615,3846... -> moi ngay lam tron thanh 384.615
    const rate = 10_000_000 / 26;
    const lines = Array.from({ length: 26 }, (_, index) =>
      day({
        date: `2026-08-${String(index + 1).padStart(2, "0")}`,
        dailyRate: rate,
      }),
    );

    const total = sumDailyPay(lines);

    // 384.615 x 26 = 9.999.990 — KHONG phai 10.000.000. Day la danh doi da
    // duoc chap nhan CO Y THUC: tong LUON bang tong cac dong hien ra.
    expect(total.basePay).toBe(9_999_990);
    expect(total.dayTotal).toBe(9_999_990);
  });

  it("13. mot ngay thieu du kien -> ca tong null, khong cong bo phan", () => {
    const total = sumDailyPay([
      day(),
      day({
        credit: credit({
          creditedDays: null,
          regularMinutes: null,
          missing: "standard_hours_per_day",
        }),
      }),
    ]);

    expect(total.basePay).toBeNull();
    expect(total.dayTotal).toBeNull();
    expect(total.missing).toContain("standard_hours_per_day");
  });

  it("13b. thieu HE SO TANG CA -> chi overtimePay null, luong goc VAN ra so", () => {
    // Ba thanh phan doc lap nhau: nguoi xem can biet phan nao ra so va phan
    // nao khong. Gop ca ba thanh `null` se giau di thu he thong that su biet.
    const total = sumDailyPay([
      day(),
      day({
        classification: classification({
          overtimeMinutes: 60,
          convertedOvertimeHours: null,
          missingMultiplierKeys: ["weekday"],
        }),
      }),
    ]);

    // 500.000 x 2 ngay = 1.000.000 — van cong duoc.
    expect(total.basePay).toBe(1_000_000);
    expect(total.overtimePay).toBeNull();
    // Nhung TONG thi khong: khong cong phan da biet roi trinh bay nhu day du.
    expect(total.dayTotal).toBeNull();
    expect(total.missing).toContain("overtime_rule:weekday");
  });

  it("14. ngay dang do KHONG lam tong thanh null, no chi khong gop gi", () => {
    const total = sumDailyPay([day(), day({ hasOpenPunch: true })]);

    // Chi ngay hoan tat gop vao: 500.000
    expect(total.dayTotal).toBe(500_000);
    expect(total.missing).toEqual([]);
  });
});
