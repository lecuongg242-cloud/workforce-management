import { describe, expect, it } from "vitest";

import {
  classifyWorkDay,
  convertedOvertimeHours,
  creditedMinutesPerPunch,
  isoWeekday,
  nightMinutes,
  overtimeMinutes,
  overtimeNightMinutes,
  splitPunchOvertime,
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


/**
 * TACH TANG CA THEO LUOT.
 *
 * Bai quan trong nhat cua nhom nay la bai doi chieu: tong cac luot phai bang
 * dung con so cua ca ngay. Neu no lech, mot the ngay se hien ba dong khong
 * cong lai thanh dong thu tu — va nguoi doc khong con ly do tin dong nao.
 */
describe("splitPunchOvertime — phần tăng ca của từng lượt", () => {
  /**
   * Ngay co that trong anh chup cua nguoi dung: ca linh hoat 2 gio, ba luot.
   *
   * CHU Y SO PHUT CUA LUOT CUOI: hieu hai chuoi gio "11:50" -> "21:11" ra 561,
   * nhung ban ghi luu 562 (moc thoi gian day du co giay, chuoi hien thi thi
   * khong). Chenh lech mot phut nay CHINH LA loi ma bo kiem duoi day canh.
   */
  const storedMinutes = [135, 21, 562]; // tong 718 = 11h58, dung nhu the ngay
  const segments = toWorkSegments([
    { checkIn: "09:14", checkOut: "11:29" },
    { checkIn: "11:29", checkOut: "11:50" },
    { checkIn: "11:50", checkOut: "21:11" },
  ]);
  const threePunches = segments.map((segment, index) => ({
    creditedMinutes: storedMinutes[index],
    segment,
  }));

  it("1. tăng ca là phần CUỐI ngày, nên nó ăn ngược từ lượt cuối lên", () => {
    // Tong 718 phut, ca 120 phut -> tang ca 598 phut.
    // Luot 3 (562) va luot 2 (21) vao het; luot 1 gop 598-562-21 = 15 phut.
    const split = splitPunchOvertime({
      punches: threePunches,
      overtimeMinutes: 598,
      nightStart: "22:00",
      nightEnd: "06:00",
    });

    expect(split.map((item) => item.overtimeMinutes)).toEqual([15, 21, 562]);
    expect(split.map((item) => item.regularMinutes)).toEqual([120, 0, 0]);
  });

  it("2. số phút lấy từ BẢN GHI, không đo lại từ chuỗi giờ hiển thị", () => {
    // Do lai tu chuoi gio se ra 561 cho luot cuoi, va mot phut chenh se don
    // het vao luot DAU: "Trong ca 1h59" ngay duoi "Trong ca 2h00" cua ngay.
    const split = splitPunchOvertime({
      punches: threePunches,
      overtimeMinutes: 598,
      nightStart: "22:00",
      nightEnd: "06:00",
    });

    expect(split[0].regularMinutes).toBe(120); // 2h00 tron, KHONG phai 1h59
    expect(split[2].overtimeMinutes).toBe(562);
  });

  it("3. tổng các lượt BẰNG ĐÚNG số phút của ngày, cả hai vế", () => {
    const overtime = 598;
    const split = splitPunchOvertime({
      punches: threePunches,
      overtimeMinutes: overtime,
      nightStart: "22:00",
      nightEnd: "06:00",
    });

    expect(split.reduce((sum, item) => sum + item.overtimeMinutes, 0)).toBe(
      overtime,
    );
    // 718 - 598 = 120 — dung con so "Trong ca" cua ngay.
    expect(split.reduce((sum, item) => sum + item.regularMinutes, 0)).toBe(120);
    // Va hai phan cua moi luot cong lai bang dung so phut cua luot do.
    expect(
      split.map((item) => item.regularMinutes + item.overtimeMinutes),
    ).toEqual(storedMinutes);
  });

  it("4. phút đêm của các lượt cộng lại bằng `overtimeNightMinutes` của ngày", () => {
    const nightSegments = toWorkSegments([
      { checkIn: "09:14", checkOut: "11:29" },
      { checkIn: "11:50", checkOut: "23:30" },
    ]);
    const overtime = 600;
    const split = splitPunchOvertime({
      punches: nightSegments.map((segment) => ({
        creditedMinutes: segment.end - segment.start,
        segment,
      })),
      overtimeMinutes: overtime,
      nightStart: "22:00",
      nightEnd: "06:00",
    });

    expect(split.reduce((sum, item) => sum + item.overtimeNightMinutes, 0)).toBe(
      overtimeNightMinutes({
        segments: nightSegments,
        overtimeMinutes: overtime,
        nightStart: "22:00",
        nightEnd: "06:00",
      }),
    );
  });

  it("5. ngày KHÔNG tăng ca -> mọi lượt đều 0, không âm", () => {
    const split = splitPunchOvertime({
      punches: threePunches,
      overtimeMinutes: 0,
      nightStart: "22:00",
      nightEnd: "06:00",
    });

    expect(split.every((item) => item.overtimeMinutes === 0)).toBe(true);
    expect(split.map((item) => item.regularMinutes)).toEqual(storedMinutes);
  });

  it("6. ngày lễ (TOÀN BỘ giờ là tăng ca) -> không lượt nào còn giờ trong ca", () => {
    const split = splitPunchOvertime({
      punches: threePunches,
      overtimeMinutes: 718,
      nightStart: "22:00",
      nightEnd: "06:00",
    });

    expect(split.map((item) => item.regularMinutes)).toEqual([0, 0, 0]);
    expect(split.map((item) => item.overtimeMinutes)).toEqual(storedMinutes);
  });
});

/**
 * GIO NGHI CHIA VE TUNG LUOT.
 *
 * Mot bat bien duy nhat dang ke: tong sau khi tru bang dung
 * `day.workedMinutes`. Sai o day thi "Trong ca" cua cac luot lai lech voi cua
 * ngay — dung cai loi ma `splitPunchOvertime` vua duoc sua de tranh.
 */
describe("creditedMinutesPerPunch — giờ nghỉ của ca chia về từng lượt", () => {
  it("7. không có giờ nghỉ -> giữ nguyên, không đụng vào con số nào", () => {
    expect(
      creditedMinutesPerPunch({ rawMinutes: [240, 300], breakMinutes: 0 }),
    ).toEqual([240, 300]);
  });

  it("8. tổng sau khi trừ BẰNG ĐÚNG tổng thô trừ giờ nghỉ", () => {
    const credited = creditedMinutesPerPunch({
      rawMinutes: [135, 21, 562],
      breakMinutes: 60,
    });

    expect(credited.reduce((sum, value) => sum + value, 0)).toBe(718 - 60);
  });

  it("9. phần dư sau làm tròn KHÔNG bị mất — chia hết tới phút cuối", () => {
    // Ba luot bang nhau, 10 phut nghi -> 3,33 moi luot. Lam tron xuong het thi
    // mat 1 phut; phan du phai duoc don vao mot luot nao do.
    const credited = creditedMinutesPerPunch({
      rawMinutes: [100, 100, 100],
      breakMinutes: 10,
    });

    expect(credited.reduce((sum, value) => sum + value, 0)).toBe(290);
  });

  it("10. giờ nghỉ dài hơn cả ngày làm -> sàn 0, không có lượt nào âm", () => {
    const credited = creditedMinutesPerPunch({
      rawMinutes: [30, 20],
      breakMinutes: 90,
    });

    expect(credited.every((value) => value >= 0)).toBe(true);
    expect(credited.reduce((sum, value) => sum + value, 0)).toBe(0);
  });
});
