import { describe, expect, it } from "vitest";

import { toDailyRate, toHourlyRate, type RateInput } from "@/lib/payroll/rate";

/**
 * Quy doi don vi luong (D-38).
 *
 * Bo so dung xuyen file: **26 ngay cong chuan / thang**, **8 gio / ngay** —
 * hai con so cua MOT doanh nghiep cu the, khong phai hai hang so cua he thong.
 * Chung duoc viet ra o day de moi phep tinh tay trong test doc duoc.
 */

const DAYS_PER_MONTH = 26;
const HOURS_PER_DAY = 8;

function input(overrides: Partial<RateInput> & Pick<RateInput, "unit" | "amount">): RateInput {
  return {
    standardDaysPerMonth: DAYS_PER_MONTH,
    standardHoursPerDay: HOURS_PER_DAY,
    ...overrides,
  };
}

describe("toDailyRate — đơn giá một ngày công", () => {
  it("1. lương THÁNG -> chia cho số ngày công chuẩn", () => {
    // 13.000.000 / 26 = 500.000
    expect(toDailyRate(input({ unit: "month", amount: 13_000_000 })).value).toBe(500_000);
  });

  it("2. lương NGÀY -> chính nó, không mẫu số nào tham gia", () => {
    expect(toDailyRate(input({ unit: "day", amount: 450_000 })).value).toBe(450_000);
  });

  it("3. lương GIỜ -> nhân số giờ chuẩn một ngày", () => {
    // 60.000 x 8 = 480.000
    expect(toDailyRate(input({ unit: "hour", amount: 60_000 })).value).toBe(480_000);
  });
});

describe("toHourlyRate — đơn giá một giờ", () => {
  it("4. lương GIỜ -> chính nó, không mẫu số nào tham gia", () => {
    expect(toHourlyRate(input({ unit: "hour", amount: 60_000 })).value).toBe(60_000);
  });

  it("5. lương NGÀY -> chia cho số giờ chuẩn một ngày", () => {
    // 480.000 / 8 = 60.000
    expect(toHourlyRate(input({ unit: "day", amount: 480_000 })).value).toBe(60_000);
  });

  it("6. lương THÁNG -> chia cho (ngày chuẩn x giờ chuẩn)", () => {
    // 13.000.000 / (26 x 8) = 62.500
    expect(toHourlyRate(input({ unit: "month", amount: 13_000_000 })).value).toBe(62_500);
  });

  it("7. hai chiều quy đổi KHỚP nhau: đơn giá ngày / giờ chuẩn = đơn giá giờ", () => {
    const daily = toDailyRate(input({ unit: "month", amount: 13_000_000 })).value;
    const hourly = toHourlyRate(input({ unit: "month", amount: 13_000_000 })).value;

    expect(daily).not.toBeNull();
    expect(hourly).not.toBeNull();
    expect((daily as number) / HOURS_PER_DAY).toBe(hourly);
  });
});

describe("Thiếu mẫu số CẦN THIẾT -> `null` kèm lý do, không đoán (D-26/D-38)", () => {
  it("8. lương tháng -> đơn giá ngày mà thiếu số ngày chuẩn -> `null`", () => {
    const result = toDailyRate(
      input({ unit: "month", amount: 13_000_000, standardDaysPerMonth: null }),
    );

    expect(result.value).toBeNull();
    expect(result.missing).toBe("standard_days_per_month");
  });

  it("9. lương ngày -> đơn giá giờ mà thiếu số giờ chuẩn -> `null`", () => {
    const result = toHourlyRate(
      input({ unit: "day", amount: 480_000, standardHoursPerDay: null }),
    );

    expect(result.value).toBeNull();
    expect(result.missing).toBe("standard_hours_per_day");
  });

  it("10. lương tháng -> đơn giá giờ cần CẢ HAI mẫu số", () => {
    expect(
      toHourlyRate(
        input({ unit: "month", amount: 13_000_000, standardDaysPerMonth: null }),
      ).missing,
    ).toBe("standard_days_per_month");
    expect(
      toHourlyRate(
        input({ unit: "month", amount: 13_000_000, standardHoursPerDay: null }),
      ).missing,
    ).toBe("standard_hours_per_day");
  });
});

describe("Thiếu mẫu số KHÔNG CẦN TỚI -> vẫn tính được", () => {
  it("11. lương GIỜ -> đơn giá giờ vẫn ra dù chưa khai cả hai mẫu số", () => {
    // Mot doanh nghiep tra luong gio khong bi chan boi hai con so ho khong
    // bao gio dung den — neu bi chan, ho se dien bua vao do de di tiep, va
    // mot mau so dien bua thi khong con la mau so cua ai ca.
    const result = toHourlyRate({
      unit: "hour",
      amount: 60_000,
      standardDaysPerMonth: null,
      standardHoursPerDay: null,
    });

    expect(result.value).toBe(60_000);
    expect(result.missing).toBeNull();
  });

  it("12. lương NGÀY -> đơn giá ngày vẫn ra dù chưa khai cả hai mẫu số", () => {
    const result = toDailyRate({
      unit: "day",
      amount: 450_000,
      standardDaysPerMonth: null,
      standardHoursPerDay: null,
    });

    expect(result.value).toBe(450_000);
    expect(result.missing).toBeNull();
  });

  it("13. lương THÁNG -> đơn giá NGÀY không cần số giờ chuẩn", () => {
    const result = toDailyRate(
      input({ unit: "month", amount: 13_000_000, standardHoursPerDay: null }),
    );

    expect(result.value).toBe(500_000);
    expect(result.missing).toBeNull();
  });
});

describe("Không làm tròn ở bước trung gian (D-42a)", () => {
  it("14. đơn giá lẻ giữ nguyên độ chính xác, KHÔNG bị cắt về đồng", () => {
    // 10.000.000 / 26 = 384.615,3846... — mot con so khong chia het.
    const daily = toDailyRate(input({ unit: "month", amount: 10_000_000 })).value;

    expect(daily).not.toBe(384_615);
    expect(daily).toBeCloseTo(384_615.3846, 4);
  });

  it("15. nhân rồi mới làm tròn KHÁC làm tròn rồi mới nhân — đây là lý do (2) tồn tại", () => {
    const daily = toDailyRate(input({ unit: "month", amount: 10_000_000 })).value as number;

    const roundThenMultiply = Math.round(daily) * 26;
    const multiplyThenRound = Math.round(daily * 26);

    // Lech 4 dong tren mot nguoi mot thang. Nhan len ca doanh nghiep va
    // muoi hai thang thi ke toan se phat hien ra.
    expect(roundThenMultiply).not.toBe(multiplyThenRound);
    expect(multiplyThenRound).toBe(10_000_000);
  });
});
