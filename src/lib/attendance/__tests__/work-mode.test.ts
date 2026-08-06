import { describe, expect, it } from "vitest";

import {
  effectiveScheduledMinutes,
  resolveDayCredit,
  sumCreditedDays,
  type DayCredit,
} from "@/lib/attendance/work-mode";
import type { AttendanceStatus, WorkMode } from "@/lib/types/domain";

/**
 * Ba che do tinh cong (D-36/D-39/D-43) o tang mo-dun thuan.
 *
 * Bai QUAN TRONG NHAT file nay la bai mang ten
 * "daily_hours voi 6 gio lam KHONG sinh 360 phut tang ca" — do la cai bay
 * D-36a viet thanh mot khang dinh chay duoc. Neu no do, moi con so tien cua
 * 05-2-04 se sai gap boi va van trong hoan toan hop ly.
 */

/** Ca 8 tieng lam viec (da tru gio nghi). */
const SHIFT_8H = { scheduledMinutes: 480 };
/** Ngay chuan 10 tieng cua che do `daily_hours` (vi du cua D-36). */
const STANDARD_10H = 10;

function day(workedMinutes: number, status: AttendanceStatus = "on_time") {
  return { workedMinutes, status };
}

function credit(
  mode: WorkMode,
  workedMinutes: number,
  overrides: Partial<{
    status: AttendanceStatus;
    dayType: "weekday" | "weekend" | "holiday";
    shift: { scheduledMinutes: number } | undefined;
    standardHoursPerDay: number | null;
  }> = {},
): DayCredit {
  return resolveDayCredit({
    day: day(workedMinutes, overrides.status ?? "on_time"),
    dayType: overrides.dayType ?? "weekday",
    mode,
    shift: "shift" in overrides ? overrides.shift : SHIFT_8H,
    standardHoursPerDay:
      "standardHoursPerDay" in overrides
        ? (overrides.standardHoursPerDay as number | null)
        : STANDARD_10H,
  });
}

describe("Chế độ `shift` — hành vi Phase 4, không đổi một con số nào", () => {
  it("1. làm đúng độ dài ca -> 1 ngày công, không giờ tăng ca", () => {
    const result = credit("shift", 480);

    expect(result.creditedDays).toBe(1);
    expect(result.regularMinutes).toBe(480);
    expect(result.overtimeMinutes).toBe(0);
    // `hourDelta` chi co nghia o `shift_hourly`.
    expect(result.hourDelta).toBe(0);
  });

  it("2. làm vượt ca -> phần vượt là tăng ca, ngày công vẫn là 1", () => {
    const result = credit("shift", 600);

    expect(result.creditedDays).toBe(1);
    expect(result.regularMinutes).toBe(480);
    expect(result.overtimeMinutes).toBe(120);
  });

  it("3. làm THIẾU so với ca -> vẫn 1 ngày công (chế độ này đếm ngày, không cộng giờ)", () => {
    const result = credit("shift", 300);

    expect(result.creditedDays).toBe(1);
    expect(result.regularMinutes).toBe(300);
    expect(result.overtimeMinutes).toBe(0);
    expect(result.hourDelta).toBe(0);
  });

  it("4. ngày lễ / ngoài lịch làm việc -> TOÀN BỘ giờ là tăng ca và ngày công là 0 (không trả hai lần)", () => {
    for (const dayType of ["holiday", "weekend"] as const) {
      const result = credit("shift", 480, { dayType });
      expect(result.overtimeMinutes).toBe(480);
      expect(result.regularMinutes).toBe(0);
      expect(result.creditedDays).toBe(0);
    }
  });
});

describe("Chế độ `daily_hours` — một công = N giờ (D-36a, D-39)", () => {
  it("5. CÁI BẪY D-36a: 6 giờ làm KHÔNG sinh 360 phút tăng ca", () => {
    const result = credit("daily_hours", 360);

    // Neu che do nay di qua nhanh cu voi `scheduledMinutes = 0`, con so duoi
    // day se la 360 — toan bo gio lam thanh tang ca, va luong ra gap ruoi.
    expect(result.overtimeMinutes).toBe(0);
    expect(result.regularMinutes).toBe(360);
  });

  it("6. làm 6/10 tiếng -> ngày công là 0,6 (D-39: ngày công thành số thập phân)", () => {
    const result = credit("daily_hours", 360);

    expect(result.creditedDays).toBe(0.6);
  });

  it("7. làm 12 tiếng trong ngày chuẩn 10 tiếng -> 10 giờ thường + 2 giờ tăng ca, ngày công là 1", () => {
    const result = credit("daily_hours", 720);

    expect(result.regularMinutes).toBe(600);
    expect(result.overtimeMinutes).toBe(120);
    expect(result.creditedDays).toBe(1);
  });

  it("8. ĐỘ DÀI CA BỊ BỎ QUA HOÀN TOÀN — chế độ này nghĩa là không có ca", () => {
    const withShift = credit("daily_hours", 480, { shift: SHIFT_8H });
    const withoutShift = credit("daily_hours", 480, { shift: undefined });

    // Ca 8 tieng co mat hay khong cung khong duoc lam doi ket qua: neu no lam
    // doi, nghia la mau so dang bi lay tu mot cai ca ma che do nay khong dung.
    expect(withShift).toEqual(withoutShift);
    expect(withShift.overtimeMinutes).toBe(0);
    expect(withShift.creditedDays).toBe(0.8);
  });

  it("9. chưa khai `standard_hours_per_day` -> trả LÝ DO, không trả một con số đoán (D-26)", () => {
    const result = credit("daily_hours", 480, { standardHoursPerDay: null });

    expect(result.missing).toBe("standard_hours_per_day");
    expect(result.creditedDays).toBeNull();
    expect(result.regularMinutes).toBeNull();
    expect(result.overtimeMinutes).toBeNull();
  });

  it("10. chưa khai mẫu số thì KHÔNG lùi về 8 giờ và KHÔNG lấy độ dài ca", () => {
    const missing = credit("daily_hours", 480, { standardHoursPerDay: null });
    const eightHours = credit("daily_hours", 480, { standardHoursPerDay: 8 });

    // Neu co mot mau so du phong nao do, hai ket qua nay se giong nhau.
    expect(missing).not.toEqual(eightHours);
    expect(
      effectiveScheduledMinutes({
        mode: "daily_hours",
        shift: SHIFT_8H,
        standardHoursPerDay: null,
      }),
    ).toBeNull();
  });
});

describe("Chế độ `shift_hourly` — ngày công theo ca, tiền bám giờ thực tế", () => {
  it("11. thiếu giờ so với ca -> hourDelta ÂM, ngày công vẫn là 1", () => {
    const result = credit("shift_hourly", 400);

    expect(result.hourDelta).toBe(-80);
    expect(result.creditedDays).toBe(1);
  });

  it("12. thừa giờ so với ca -> hourDelta DƯƠNG, và phần vượt vẫn là tăng ca", () => {
    const result = credit("shift_hourly", 540);

    expect(result.hourDelta).toBe(60);
    expect(result.overtimeMinutes).toBe(60);
  });

  it("13. không xác định được ca -> hourDelta bằng 0, không bịa ra một độ lệch", () => {
    const result = credit("shift_hourly", 480, { shift: undefined });

    expect(result.hourDelta).toBe(0);
  });
});

describe("Nghỉ phép và nghỉ không phép (D-43)", () => {
  it("14. `leave_unpaid` -> 0 ngày công ở CẢ BA chế độ", () => {
    for (const mode of ["shift", "daily_hours", "shift_hourly"] as const) {
      const result = credit(mode, 0, { status: "leave_unpaid" });
      expect(result.creditedDays).toBe(0);
      expect(result.regularMinutes).toBe(0);
      expect(result.overtimeMinutes).toBe(0);
    }
  });

  it("15. `leave_paid` -> 1 ngày công ở CẢ BA chế độ, kể cả khi chưa khai mẫu số", () => {
    for (const mode of ["shift", "daily_hours", "shift_hourly"] as const) {
      const result = credit(mode, 0, {
        status: "leave_paid",
        standardHoursPerDay: null,
      });
      expect(result.creditedDays).toBe(1);
      expect(result.missing).toBeNull();
    }
  });
});

describe("Cùng một ngày qua ba chế độ ra ba kết quả khác nhau", () => {
  it("16. 6 giờ làm trong ca 8 tiếng / ngày chuẩn 10 tiếng -> ba bộ số phân biệt được", () => {
    const shift = credit("shift", 360);
    const dailyHours = credit("daily_hours", 360);
    const shiftHourly = credit("shift_hourly", 360);

    expect(shift.creditedDays).toBe(1);
    expect(dailyHours.creditedDays).toBe(0.6);
    expect(shiftHourly.creditedDays).toBe(1);

    // `shift` va `shift_hourly` khac nhau o `hourDelta`, khong o ngay cong.
    expect(shift.hourDelta).toBe(0);
    expect(shiftHourly.hourDelta).toBe(-120);

    // Ba ket qua doi mot khac nhau — neu hai trong ba giong het nhau thi mot
    // che do chua duoc noi vao dau ca.
    expect(shift).not.toEqual(dailyHours);
    expect(shift).not.toEqual(shiftHourly);
    expect(dailyHours).not.toEqual(shiftHourly);
  });
});

describe("sumCreditedDays — tổng của một tháng", () => {
  it("17. cộng ngày công thập phân và độ lệch giờ", () => {
    const total = sumCreditedDays([
      credit("daily_hours", 360),
      credit("daily_hours", 600),
      credit("daily_hours", 720),
    ]);

    // 0,6 + 1 + 1
    expect(total.creditedDays).toBe(2.6);
    expect(total.regularMinutes).toBe(360 + 600 + 600);
    expect(total.missing).toEqual([]);
  });

  it("18. một ngày thiếu mẫu số -> TỔNG trả `null`, không cộng bộ phận (D-26)", () => {
    const total = sumCreditedDays([
      credit("daily_hours", 600),
      credit("daily_hours", 480, { standardHoursPerDay: null }),
    ]);

    expect(total.creditedDays).toBeNull();
    expect(total.regularMinutes).toBeNull();
    expect(total.missing).toEqual(["standard_hours_per_day"]);
  });

  it("19. tháng không có ngày nào -> toàn số 0, không phải `null`", () => {
    const total = sumCreditedDays([]);

    expect(total.creditedDays).toBe(0);
    expect(total.regularMinutes).toBe(0);
    expect(total.hourDeltaMinutes).toBe(0);
    expect(total.missing).toEqual([]);
  });
});
