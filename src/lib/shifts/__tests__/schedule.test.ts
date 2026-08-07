import { describe, expect, it } from "vitest";

import { buildShiftContext } from "@/lib/attendance/shift-context";
import {
  formatShiftLabel,
  formatShiftSchedule,
  hoursShiftCode,
  hoursShiftName,
  hoursToMinutes,
  isHoursBasedShift,
  minutesToHours,
  shiftGrossMinutes,
  shiftScheduledMinutes,
} from "@/lib/shifts/schedule";

/**
 * CA LINH HOAT (migration 0027) o tang mo-dun thuan.
 *
 * Bai QUAN TRONG NHAT file nay la bai mang ten "ca linh hoat KHONG bao gio cho
 * scheduledMinutes bang 0". Do la cai bay D-36a — thu ma `work-mode.ts` mo ta
 * bang mot khoi comment dai — viet thanh mot khang dinh chay duoc:
 *
 *     scheduledMinutes = 0  ->  overtimeMinutes = max(worked - 0, 0) = TOAN BO
 *
 * Nghia la mot nguoi lam 10 tieng binh thuong bong nhien co 10 gio tang ca, roi
 * bang luong nhan so gio do voi he so. Con so KHONG bao loi — no chi khac di,
 * va no trong hoan toan hop ly tren man hinh.
 */

const FIXED_8H = {
  kind: "fixed" as const,
  startTime: "08:00",
  endTime: "17:00",
  durationMinutes: null,
  breakMinutes: 60,
};

const FLEX_10H = {
  kind: "hours" as const,
  startTime: null,
  endTime: null,
  durationMinutes: 600,
  breakMinutes: 0,
};

describe("shiftGrossMinutes / shiftScheduledMinutes — một nơi duy nhất biết cả hai loại ca", () => {
  it("1. ca `fixed` giữ nguyên hành vi cũ: hiệu hai giờ, rồi trừ giờ nghỉ", () => {
    expect(shiftGrossMinutes(FIXED_8H)).toBe(540);
    expect(shiftScheduledMinutes(FIXED_8H)).toBe(480);
  });

  it("2. ca `fixed` QUA ĐÊM tính đúng độ dài, không ra số âm", () => {
    const overnight = { ...FIXED_8H, startTime: "22:00", endTime: "06:00" };

    expect(shiftGrossMinutes(overnight)).toBe(480);
    expect(shiftScheduledMinutes(overnight)).toBe(420);
  });

  it("3. ca linh hoạt KHÔNG BAO GIỜ cho scheduledMinutes bằng 0 (bẫy D-36a)", () => {
    // Neu ham nay lui ve 0 cho ca linh hoat thi toan bo gio lam cua nguoi do
    // thanh tang ca, va khong mot dong loi nao duoc sinh ra.
    expect(shiftScheduledMinutes(FLEX_10H)).toBe(600);
    expect(shiftGrossMinutes(FLEX_10H)).toBe(600);
  });

  it("4. ca linh hoạt KHÔNG đi qua minutesBetween, nên hai giờ null không thành NaN", () => {
    const result = shiftScheduledMinutes(FLEX_10H);

    expect(Number.isNaN(result)).toBe(false);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("5. `isHoursBasedShift` phân biệt đúng hai loại", () => {
    expect(isHoursBasedShift(FLEX_10H)).toBe(true);
    expect(isHoursBasedShift(FIXED_8H)).toBe(false);
  });
});

describe("formatShiftSchedule — không màn hình nào in ra 'null–null'", () => {
  it("6. ca `fixed` hiện khung giờ như cũ", () => {
    expect(formatShiftSchedule(FIXED_8H)).toBe("08:00–17:00");
  });

  it("7. ca linh hoạt hiện độ dài, KHÔNG hiện hai dấu gạch rỗng", () => {
    const label = formatShiftSchedule(FLEX_10H);

    expect(label).toBe("10 giờ / ngày");
    expect(label).not.toContain("null");
  });

  it("8. nhãn kèm tên ca dùng chung một phép định dạng", () => {
    expect(formatShiftLabel({ ...FLEX_10H, name: "Ca linh hoạt 10 giờ" })).toBe(
      "Ca linh hoạt 10 giờ (10 giờ / ngày)",
    );
  });
});

describe("Tên và mã ca linh hoạt — sinh từ chính số giờ để hai người cùng giờ dùng chung một ca", () => {
  it("9. cùng số phút -> cùng tên và cùng mã", () => {
    expect(hoursShiftName(600)).toBe(hoursShiftName(600));
    expect(hoursShiftCode(600)).toBe(hoursShiftCode(600));
  });

  it("10. khác số phút -> khác mã, nên không đè lên nhau", () => {
    expect(hoursShiftCode(600)).not.toBe(hoursShiftCode(450));
  });

  it("11. giờ lẻ quy về phút nguyên và quay lại đúng giá trị cũ", () => {
    expect(hoursToMinutes(7.5)).toBe(450);
    expect(minutesToHours(450)).toBe(7.5);
  });
});

describe("buildShiftContext — ba đường đọc ca dùng chung một phép dựng", () => {
  const rows = [
    {
      id: "sft-fixed",
      kind: "fixed" as const,
      break_minutes: 60,
      start_time: "08:00:00",
      end_time: "17:00:00",
      duration_minutes: null,
      working_days: [1, 2, 3, 4, 5],
    },
    {
      id: "sft-flex",
      kind: "hours" as const,
      break_minutes: 0,
      start_time: null,
      end_time: null,
      duration_minutes: 600,
      working_days: [1, 2, 3, 4, 5, 6],
    },
  ];

  it("12. ca `fixed` giữ nguyên breaks và scheduledMinutes như trước 0027", () => {
    const { breaks, shiftRules } = buildShiftContext(rows);

    expect(breaks["sft-fixed"]).toEqual({ breakMinutes: 60, shiftMinutes: 540 });
    expect(shiftRules.get("sft-fixed")?.scheduledMinutes).toBe(480);
  });

  it("13. ca linh hoạt có scheduledMinutes THẬT, không phải 0 (bẫy D-36a ở tầng đọc)", () => {
    const { breaks, shiftRules } = buildShiftContext(rows);

    expect(breaks["sft-flex"]).toEqual({ breakMinutes: 0, shiftMinutes: 600 });
    expect(shiftRules.get("sft-flex")?.scheduledMinutes).toBe(600);
  });

  it("14. lịch tuần đi kèm đúng ca của nó, không lẫn giữa hai dòng", () => {
    const { shiftRules } = buildShiftContext(rows);

    expect(shiftRules.get("sft-fixed")?.workingDays).toEqual([1, 2, 3, 4, 5]);
    expect(shiftRules.get("sft-flex")?.workingDays).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
