import { describe, expect, it } from "vitest";

import { summarizeMonth, type MonthContext } from "@/lib/attendance/month-context";
import type { AttendanceRecord } from "@/lib/types/domain";

/**
 * `summarizeMonth()` tra them mang NGAY.
 *
 * BAI QUAN TRONG NHAT la bai 4: cac truong TONG CU khong doi khi mang ngay
 * duoc them vao. `summarizeMonth()` con duoc `GET /api/attendance/summary`
 * dung, va mot thay doi im lang o do se lam lech man hinh cham cong ma khong
 * ai noi cho biet.
 */

const CONTEXT: MonthContext = {
  start: "2026-08-01",
  end: "2026-09-01",
  breaks: { "shift-1": { breakMinutes: 60, shiftMinutes: 540 } },
  shiftRules: new Map([
    ["shift-1", { workingDays: [1, 2, 3, 4, 5], scheduledMinutes: 480 }],
  ]),
  rules: {
    holidayDates: new Set<string>(),
    nightStartTime: "22:00",
    nightEndTime: "06:00",
    versionsByKey: new Map(),
    workMode: "shift",
    standardHoursPerDay: 8,
    standardDaysPerMonth: 26,
  },
};

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "att-1",
    companyId: "cty-01",
    employeeId: "nv-1",
    // 03/08/2026 la thu Hai — nam trong `workingDays` cua ca.
    date: "2026-08-03",
    shiftId: "shift-1",
    checkIn: "08:00",
    checkOut: "17:00",
    // THO, CHUA tru gio nghi: 08:00-17:00 = 540 phut. `groupAttendanceByDay()`
    // tru gio nghi theo TY LE thoi gian co mat — co mat tron ca (540/540) thi
    // tru tron 60 phut, ra 480 phut duoc tinh cong.
    workedMinutes: 540,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: "on_time",
    location: "Văn phòng chính",
    needsSupplement: false,
    note: null,
    ...overrides,
  };
}

describe("summarizeMonth — mảng ngày", () => {
  it("1. mỗi ngày có bản ghi cho ra đúng một phần tử", () => {
    const summary = summarizeMonth({
      records: [record(), record({ id: "att-2", date: "2026-08-04" })],
      context: CONTEXT,
      month: "2026-08",
    });

    expect(summary.days).toHaveLength(2);
    expect(summary.days.map((day) => day.date).sort()).toEqual([
      "2026-08-03",
      "2026-08-04",
    ]);
  });

  it("2. mỗi phần tử mang credit + classification + trạng thái ngày", () => {
    const summary = summarizeMonth({
      records: [record()],
      context: CONTEXT,
      month: "2026-08",
    });

    const [day] = summary.days;
    expect(day.credit.creditedDays).toBe(1);
    expect(day.credit.regularMinutes).toBe(480);
    expect(day.classification.dayType).toBe("weekday");
    expect(day.status).toBe("on_time");
    expect(day.hasOpenPunch).toBe(false);
    expect(day.workedMinutes).toBe(480);
  });

  it("3. ngày chưa chấm ra -> hasOpenPunch true", () => {
    const summary = summarizeMonth({
      records: [record({ checkOut: null, workedMinutes: 0 })],
      context: CONTEXT,
      month: "2026-08",
    });

    expect(summary.days[0].hasOpenPunch).toBe(true);
  });

  it("4. các trường tổng CŨ không đổi khi thêm mảng ngày", () => {
    const summary = summarizeMonth({
      records: [record(), record({ id: "att-2", date: "2026-08-04" })],
      context: CONTEXT,
      month: "2026-08",
    });

    expect(summary.month).toBe("2026-08");
    expect(summary.workedDays).toBe(2);
    expect(summary.totalMinutes).toBe(960);
    expect(summary.creditedDays).toBe(2);
    expect(summary.regularMinutes).toBe(960);
    expect(summary.lateCount).toBe(0);
    expect(summary.leaveDays).toBe(0);
  });

  it("5. tháng không có bản ghi -> mảng ngày rỗng, không phải undefined", () => {
    const summary = summarizeMonth({
      records: [],
      context: CONTEXT,
      month: "2026-08",
    });

    expect(summary.days).toEqual([]);
    expect(summary.workedDays).toBe(0);
  });

  it("6. thứ tự mảng ngày khớp thứ tự credit/classification tương ứng", () => {
    // Ba ngay VOI SO GIO KHAC NHAU — neu `credits[index]` bi lech mot nhip so
    // voi `days[index]` thi bai nay do, con bai 2 (mot ngay) thi khong.
    //
    // Ca ba deu co mat tron ca tro len nen deu bi tru tron 60 phut nghi:
    //   540 tho -> 480 cong -> ca 480 -> 0 phut tang ca
    //   660 tho -> 600 cong -> ca 480 -> 120 phut tang ca
    //   600 tho -> 540 cong -> ca 480 -> 60 phut tang ca
    const summary = summarizeMonth({
      records: [
        record({ id: "a", date: "2026-08-03", workedMinutes: 540 }),
        record({ id: "b", date: "2026-08-04", workedMinutes: 660 }),
        record({ id: "c", date: "2026-08-05", workedMinutes: 600 }),
      ],
      context: CONTEXT,
      month: "2026-08",
    });

    const byDate = new Map(summary.days.map((day) => [day.date, day]));
    expect(byDate.get("2026-08-03")!.classification.overtimeMinutes).toBe(0);
    expect(byDate.get("2026-08-04")!.classification.overtimeMinutes).toBe(120);
    expect(byDate.get("2026-08-05")!.classification.overtimeMinutes).toBe(60);
    // Phan gio THUONG bi tran o do dai ca — ca ba ngay deu la 480.
    expect(byDate.get("2026-08-04")!.credit.regularMinutes).toBe(480);
    expect(byDate.get("2026-08-04")!.workedMinutes).toBe(600);
  });
});
