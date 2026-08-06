import { describe, expect, it } from "vitest";

import {
  classifyWorkDay,
  convertedOvertimeHours,
  isoWeekday,
  nightMinutes,
  overtimeMinutes,
  overtimeNightMinutes,
  toWorkSegments,
} from "@/lib/attendance/classification";
import type { WeekdayNumber } from "@/lib/types/domain";

/**
 * Phan loai cong (SET-04, plan 04-05) — module thuan nen kiem duoc tung nhanh.
 *
 * Bon bai quan trong nhat:
 *   - ca qua dem 22:00-06:00 (D-08: tinh tron vao ngay bat dau);
 *   - ngay vua le vua ngoai lich lam viec;
 *   - cong don hai lop cua D-28a (le x3.0 + dem 0.3 -> x3.3, khong phai x3.9);
 *   - thieu he so tra `null`, khong bao gio 1.0 (D-26).
 */

const MON_TO_FRI: WeekdayNumber[] = [1, 2, 3, 4, 5];
const ALL_DAYS: WeekdayNumber[] = [1, 2, 3, 4, 5, 6, 7];

describe("isoWeekday", () => {
  it("1. trả đúng thứ theo quy ước ISO, không lệch vì múi giờ", () => {
    expect(isoWeekday("2026-08-06")).toBe(4); // Thu Nam
    expect(isoWeekday("2026-08-08")).toBe(6); // Thu Bay
    expect(isoWeekday("2026-08-09")).toBe(7); // Chu Nhat
    expect(isoWeekday("2026-08-10")).toBe(1); // Thu Hai
  });
});

describe("classifyWorkDay", () => {
  it("2. ngày trong lịch làm việc, không phải ngày lễ -> weekday", () => {
    expect(
      classifyWorkDay({
        workDate: "2026-08-06",
        holidayDates: [],
        workingDays: MON_TO_FRI,
      }),
    ).toBe("weekday");
  });

  it("3. ngày NGOÀI working_days của ca -> weekend, không giả định Thứ Bảy/Chủ Nhật", () => {
    expect(
      classifyWorkDay({
        workDate: "2026-08-08", // Thu Bay
        holidayDates: [],
        workingDays: MON_TO_FRI,
      }),
    ).toBe("weekend");

    // Ca lam ca tuan, nghi Thu Tu -> chinh Thu Tu moi la "ngay nghi".
    const wedOff: WeekdayNumber[] = [1, 2, 4, 5, 6, 7];
    expect(
      classifyWorkDay({
        workDate: "2026-08-08", // Thu Bay — VAN la ngay lam cua ca nay
        holidayDates: [],
        workingDays: wedOff,
      }),
    ).toBe("weekday");
    expect(
      classifyWorkDay({
        workDate: "2026-08-05", // Thu Tu
        holidayDates: [],
        workingDays: wedOff,
      }),
    ).toBe("weekend");
  });

  it("4. ngày lễ -> holiday; vừa lễ vừa ngoài lịch làm việc vẫn là holiday (lễ ưu tiên)", () => {
    expect(
      classifyWorkDay({
        workDate: "2026-08-06",
        holidayDates: ["2026-08-06"],
        workingDays: MON_TO_FRI,
      }),
    ).toBe("holiday");

    expect(
      classifyWorkDay({
        workDate: "2026-08-09", // Chu Nhat VA la ngay le
        holidayDates: new Set(["2026-08-09"]),
        workingDays: MON_TO_FRI,
      }),
    ).toBe("holiday");
  });
});

describe("toWorkSegments / nightMinutes", () => {
  it("5. ca qua đêm 22:00-06:00 thành MỘT đoạn liên tục, không bị cắt đôi qua hai ngày (D-08)", () => {
    const segments = toWorkSegments([{ checkIn: "22:00", checkOut: "06:00" }]);

    expect(segments).toEqual([{ start: 1320, end: 1800 }]);
    expect(
      nightMinutes({ segments, nightStart: "22:00", nightEnd: "06:00" }),
    ).toBe(480);
  });

  it("6. bản ghi nằm trọn ngoài khung đêm -> 0 phút đêm", () => {
    const segments = toWorkSegments([{ checkIn: "08:00", checkOut: "17:00" }]);

    expect(
      nightMinutes({ segments, nightStart: "22:00", nightEnd: "06:00" }),
    ).toBe(0);
  });

  it("7. đoạn cắt qua mốc bắt đầu khung đêm -> chỉ tính phần giao", () => {
    const segments = toWorkSegments([{ checkIn: "18:00", checkOut: "23:30" }]);

    expect(
      nightMinutes({ segments, nightStart: "22:00", nightEnd: "06:00" }),
    ).toBe(90);
  });

  it("8. khung giờ đêm TUỲ CHỈNH khác mặc định vẫn tính đúng (D-27: doanh nghiệp sửa được)", () => {
    const segments = toWorkSegments([{ checkIn: "18:00", checkOut: "23:00" }]);

    expect(
      nightMinutes({ segments, nightStart: "20:00", nightEnd: "04:00" }),
    ).toBe(180);
  });

  it("9. lượt chưa tan ca bị bỏ qua, không đoán một giờ ra không tồn tại", () => {
    const segments = toWorkSegments([
      { checkIn: "08:00", checkOut: "12:00" },
      { checkIn: "13:00", checkOut: null },
    ]);

    expect(segments).toHaveLength(1);
  });

  it("10. nhiều lượt trong ngày giữ đúng thứ tự và tự nhận ra lượt sang ngày hôm sau", () => {
    const segments = toWorkSegments([
      { checkIn: "20:00", checkOut: "23:00" },
      { checkIn: "23:30", checkOut: "02:00" },
    ]);

    expect(segments).toEqual([
      { start: 1200, end: 1380 },
      { start: 1410, end: 1560 },
    ]);
  });
});

describe("overtimeMinutes", () => {
  it("11. ngày thường: chỉ phần vượt trên độ dài ca theo kế hoạch, sàn 0", () => {
    expect(
      overtimeMinutes({ workedMinutes: 600, scheduledMinutes: 480, dayType: "weekday" }),
    ).toBe(120);
    expect(
      overtimeMinutes({ workedMinutes: 400, scheduledMinutes: 480, dayType: "weekday" }),
    ).toBe(0);
  });

  it("12. ngày lễ và ngày nghỉ: TOÀN BỘ giờ làm là tăng ca từ phút đầu tiên", () => {
    expect(
      overtimeMinutes({ workedMinutes: 300, scheduledMinutes: 480, dayType: "holiday" }),
    ).toBe(300);
    expect(
      overtimeMinutes({ workedMinutes: 300, scheduledMinutes: 480, dayType: "weekend" }),
    ).toBe(300);
  });
});

describe("overtimeNightMinutes — phần tăng ca là phần CUỐI của ngày làm", () => {
  it("13. ca hành chính làm tới 23:00: phần tăng ca chứa đúng 60 phút đêm", () => {
    const segments = toWorkSegments([{ checkIn: "08:00", checkOut: "23:00" }]);
    const overtime = overtimeMinutes({
      workedMinutes: 900,
      scheduledMinutes: 510,
      dayType: "weekday",
    });

    expect(
      overtimeNightMinutes({
        segments,
        overtimeMinutes: overtime,
        nightStart: "22:00",
        nightEnd: "06:00",
      }),
    ).toBe(60);
  });

  it("14. ca ĐÊM 22:00-06:00 làm tới 08:00: phần tăng ca (06:00-08:00) KHÔNG có phút đêm nào", () => {
    const segments = toWorkSegments([{ checkIn: "22:00", checkOut: "08:00" }]);
    const overtime = overtimeMinutes({
      workedMinutes: 600,
      scheduledMinutes: 480,
      dayType: "weekday",
    });

    // Ca ngay co 480 phut dem, nhung phan tang ca thi khong — day chinh la
    // truong hop ma Math.min(nightMinutes, overtimeMinutes) tra sai (120).
    expect(
      nightMinutes({ segments, nightStart: "22:00", nightEnd: "06:00" }),
    ).toBe(480);
    expect(
      overtimeNightMinutes({
        segments,
        overtimeMinutes: overtime,
        nightStart: "22:00",
        nightEnd: "06:00",
      }),
    ).toBe(0);
  });

  it("15. ngày lễ làm 20:00-02:00: toàn bộ là tăng ca, phần đêm là 22:00-02:00", () => {
    const segments = toWorkSegments([{ checkIn: "20:00", checkOut: "02:00" }]);
    const overtime = overtimeMinutes({
      workedMinutes: 360,
      scheduledMinutes: 480,
      dayType: "holiday",
    });

    expect(overtime).toBe(360);
    expect(
      overtimeNightMinutes({
        segments,
        overtimeMinutes: overtime,
        nightStart: "22:00",
        nightEnd: "06:00",
      }),
    ).toBe(240);
  });
});

describe("convertedOvertimeHours — cộng dồn hai lớp (D-28a)", () => {
  it("16. một giờ tăng ca ban đêm ngày lễ: lễ 3.0 + đêm 0.3 -> ×3.3, KHÔNG phải ×3.9", () => {
    const result = convertedOvertimeHours({
      dayType: "holiday",
      overtimeMinutes: 60,
      overtimeNightMinutes: 60,
      multipliers: { holiday: 3, night: 0.3 },
    });

    expect(result.hours).toBe(3.3);
    expect(result.missingKeys).toEqual([]);
  });

  it("17. tăng ca ngày thường KHÔNG rơi vào khung đêm: chỉ hệ số ngày", () => {
    const result = convertedOvertimeHours({
      dayType: "weekday",
      overtimeMinutes: 120,
      overtimeNightMinutes: 0,
      multipliers: { weekday: 1.5, night: 0.3 },
    });

    expect(result.hours).toBe(3); // 2 gio x 1.5
  });

  it("18. một phần tăng ca rơi vào đêm: phụ cấp CHỈ cộng cho phần đó", () => {
    const result = convertedOvertimeHours({
      dayType: "weekday",
      overtimeMinutes: 180, // 3 gio
      overtimeNightMinutes: 60, // trong do 1 gio la dem
      multipliers: { weekday: 1.5, night: 0.3 },
    });

    // 180*1.5 + 60*0.3 = 270 + 18 = 288 phut -> 4.8 gio
    expect(result.hours).toBe(4.8);
  });

  it("19. thiếu hệ số của loại ngày -> null kèm khoá thiếu, KHÔNG BAO GIỜ 1.0 (D-26)", () => {
    const result = convertedOvertimeHours({
      dayType: "holiday",
      overtimeMinutes: 60,
      overtimeNightMinutes: 0,
      multipliers: { weekday: 1.5 },
    });

    expect(result.hours).toBeNull();
    expect(result.missingKeys).toEqual(["holiday"]);
  });

  it("20. có phút đêm nhưng CHƯA khai phụ cấp đêm -> null, không âm thầm bỏ qua phần đêm", () => {
    const result = convertedOvertimeHours({
      dayType: "weekday",
      overtimeMinutes: 120,
      overtimeNightMinutes: 60,
      multipliers: { weekday: 1.5, night: null },
    });

    expect(result.hours).toBeNull();
    expect(result.missingKeys).toEqual(["night"]);
  });

  it("21. không có phút tăng ca nào -> 0 giờ (không thiếu gì cả), kể cả khi chưa khai hệ số", () => {
    const result = convertedOvertimeHours({
      dayType: "weekday",
      overtimeMinutes: 0,
      overtimeNightMinutes: 0,
      multipliers: {},
    });

    expect(result.hours).toBe(0);
    expect(result.missingKeys).toEqual([]);
  });

  it("22. phụ cấp đêm KHÔNG được áp cho phần tăng ca ngoài khung đêm (bất biến: mỗi phút một lần)", () => {
    const onlyDay = convertedOvertimeHours({
      dayType: "weekend",
      overtimeMinutes: 240,
      overtimeNightMinutes: 0,
      multipliers: { weekend: 2, night: 0.3 },
    });
    const halfNight = convertedOvertimeHours({
      dayType: "weekend",
      overtimeMinutes: 240,
      overtimeNightMinutes: 120,
      multipliers: { weekend: 2, night: 0.3 },
    });

    expect(onlyDay.hours).toBe(8);
    // Chenh lech dung bang phan phu cap cua 120 phut dem: 120*0.3/60 = 0.6.
    expect(Number(((halfNight.hours as number) - (onlyDay.hours as number)).toFixed(2))).toBe(
      0.6,
    );
  });
});
