import { describe, expect, it } from "vitest";

import {
  breakToDeductMinutes,
  getAttendanceDay,
  groupAttendanceByDay,
  shiftBreakInfoById,
} from "@/lib/attendance/day";
import type { AttendanceRecord } from "@/lib/types/domain";

/**
 * Tu migration 0013, mot ngay co the co NHIEU luot vao/ra. Nhom test nay khoa
 * phep gop ngay — noi duy nhat quyet dinh "mot ngay trong nhu the nao" cho
 * trang chu nhan vien va man lich su.
 */

function punch(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "att-01",
    companyId: "cty-01",
    employeeId: "emp-01",
    date: "2026-08-05",
    shiftId: "sft-01",
    checkIn: "06:02",
    checkOut: "11:30",
    workedMinutes: 328,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: "on_time",
    location: "Kho Long An",
    needsSupplement: false,
    note: null,
    ...overrides,
  };
}

describe("groupAttendanceByDay — nhieu luot trong cung mot ngay", () => {
  const twoPunches = [
    punch({ id: "att-01", checkIn: "06:02", checkOut: "11:30", workedMinutes: 328 }),
    punch({ id: "att-02", checkIn: "12:35", checkOut: "14:05", workedMinutes: 90 }),
  ];

  it("1. hai luot cua cung mot ngay gop thanh DUNG MOT ngay, khong phai hai", () => {
    expect(groupAttendanceByDay(twoPunches)).toHaveLength(1);
  });

  it("2. tong gio la CONG DON cac luot (328 + 90 = 418), khong phai gio cua luot cuoi", () => {
    expect(groupAttendanceByDay(twoPunches)[0].workedMinutes).toBe(418);
  });

  it("3. gio vao la cua luot DAU, gio ra la cua luot CUOI", () => {
    const [day] = groupAttendanceByDay(twoPunches);

    expect(day.firstCheckIn).toBe("06:02");
    expect(day.lastCheckOut).toBe("14:05");
  });

  it("4. cac luot duoc sap theo gio vao du dau vao dao lon (id la UUID, khong dung lam thu tu duoc)", () => {
    const [day] = groupAttendanceByDay([twoPunches[1], twoPunches[0]]);

    expect(day.punches.map((item) => item.checkIn)).toEqual(["06:02", "12:35"]);
  });

  it("5. di muon lay tu luot DAU — luot thu hai quay lai sau gio nghi khong bien ngay thanh hai lan di muon", () => {
    const [day] = groupAttendanceByDay([
      punch({ id: "att-01", checkIn: "08:20", lateMinutes: 20, status: "late" }),
      punch({ id: "att-02", checkIn: "12:35", checkOut: "14:05", lateMinutes: 0 }),
    ]);

    expect(day.lateMinutes).toBe(20);
    expect(day.status).toBe("late");
  });

  it("6. con luot dang mo -> hasOpenPunch = true va ve som ve 0 (chua biet luot nao la luot cuoi)", () => {
    const [day] = groupAttendanceByDay([
      punch({ id: "att-01", checkIn: "06:02", checkOut: "11:30" }),
      punch({
        id: "att-02",
        checkIn: "12:35",
        checkOut: null,
        workedMinutes: 0,
        earlyLeaveMinutes: 150,
      }),
    ]);

    expect(day.hasOpenPunch).toBe(true);
    expect(day.earlyLeaveMinutes).toBe(0);
    expect(day.lastCheckOut).toBeNull();
  });

  it("7. ve som lay tu luot CUOI — luot giua ra ngoai an trua KHONG lam ca ngay thanh ve som", () => {
    const [day] = groupAttendanceByDay([
      punch({
        id: "att-01",
        checkIn: "06:02",
        checkOut: "11:30",
        earlyLeaveMinutes: 150,
        status: "early_leave",
      }),
      punch({
        id: "att-02",
        checkIn: "12:35",
        checkOut: "14:05",
        earlyLeaveMinutes: 0,
        status: "on_time",
      }),
    ]);

    expect(day.earlyLeaveMinutes).toBe(0);
    expect(day.status).toBe("on_time");
  });

  it("8. can bo sung o BAT KY luot nao thi ca ngay duoc danh dau can bo sung", () => {
    const [day] = groupAttendanceByDay([
      punch({ id: "att-01", needsSupplement: false }),
      punch({ id: "att-02", checkIn: "12:35", needsSupplement: true }),
    ]);

    expect(day.needsSupplement).toBe(true);
  });

  it("9. hai ngay khac nhau van tra ve hai ngay", () => {
    const days = groupAttendanceByDay([
      punch({ id: "att-01", date: "2026-08-05" }),
      punch({ id: "att-02", date: "2026-08-04" }),
    ]);

    expect(days.map((day) => day.date)).toEqual(["2026-08-05", "2026-08-04"]);
  });

  it("10. dong nghi phep (khong co gio vao) khong bi tinh la mot luot nhung ngay do van con trong lich su", () => {
    const [day] = groupAttendanceByDay([
      punch({
        id: "att-01",
        checkIn: null,
        checkOut: null,
        workedMinutes: 0,
        status: "leave_paid",
      }),
    ]);

    expect(day.punches).toHaveLength(0);
    expect(day.status).toBe("leave_paid");
    expect(day.workedMinutes).toBe(0);
  });
});

/**
 * Migration 0014: `workedMinutes` cua tung luot la THO. Gio nghi tru mot lan
 * cho ca ngay, bu tru khoang nghi giua cac luot, roi tinh THEO TY LE thoi
 * gian co mat so voi do dai ca.
 *
 * Ca dung o nhom nay: 08:00-17:00 (540 phut tron ca), nghi 60 phut.
 */
describe("tru gio nghi — mot lan cho ca ngay, theo ty le thoi gian co mat", () => {
  const BREAKS = shiftBreakInfoById([
    { id: "sft-01", breakMinutes: 60, startTime: "08:00", endTime: "17:00" },
  ]);

  it("13. lam DU ca -> tru tron gio nghi, GIU NGUYEN hanh vi cu (du lieu cu khong lech)", () => {
    const [day] = groupAttendanceByDay(
      [punch({ checkIn: "08:00", checkOut: "17:00", workedMinutes: 540 })],
      BREAKS,
    );

    expect(day.breakMinutes).toBe(60);
    expect(day.workedMinutes).toBe(480);
  });

  it("14. co mat 28 phut voi ca nghi 60 phut -> KHONG con ve 0 (loi cu: greatest(28-60,0)=0)", () => {
    const [day] = groupAttendanceByDay(
      [punch({ checkIn: "14:37", checkOut: "15:05", workedMinutes: 28 })],
      BREAKS,
    );

    // 28/540 cua 60 phut = 3 phut.
    expect(day.breakMinutes).toBe(3);
    expect(day.workedMinutes).toBe(25);
  });

  it("15. co mat 2 gio tren ca 9 tieng -> tru 120/540 cua 60 phut = 13 phut, khong phai tron 60 phut", () => {
    const [day] = groupAttendanceByDay(
      [punch({ checkIn: "08:00", checkOut: "10:00", workedMinutes: 120 })],
      BREAKS,
    );

    expect(day.breakMinutes).toBe(13);
    expect(day.workedMinutes).toBe(107);
  });

  it("16. cham ra 65 phut an trua -> khoang nghi da bu du, KHONG tru them lan nua", () => {
    const [day] = groupAttendanceByDay(
      [
        punch({ id: "att-01", checkIn: "08:00", checkOut: "11:30", workedMinutes: 210 }),
        punch({ id: "att-02", checkIn: "12:35", checkOut: "17:00", workedMinutes: 265 }),
      ],
      BREAKS,
    );

    expect(day.rawMinutes).toBe(475);
    expect(day.breakMinutes).toBe(0);
    expect(day.workedMinutes).toBe(475);
  });

  it("17. cham ra 20 phut voi ca nghi 60 phut -> chi tru phan con thieu, theo ty le co mat", () => {
    const [day] = groupAttendanceByDay(
      [
        punch({ id: "att-01", checkIn: "08:00", checkOut: "11:30", workedMinutes: 210 }),
        punch({ id: "att-02", checkIn: "11:50", checkOut: "17:00", workedMinutes: 310 }),
      ],
      BREAKS,
    );

    // Con thieu 40 phut, co mat 520/540 -> 39 phut.
    expect(day.breakMinutes).toBe(39);
    expect(day.workedMinutes).toBe(481);
  });

  it("18. ba luot KHONG bi tru gio nghi ba lan (loi cu: 3 x 60 = 180 phut)", () => {
    const [day] = groupAttendanceByDay(
      [
        punch({ id: "att-01", checkIn: "08:00", checkOut: "10:00", workedMinutes: 120 }),
        punch({ id: "att-02", checkIn: "10:05", checkOut: "12:00", workedMinutes: 115 }),
        punch({ id: "att-03", checkIn: "12:10", checkOut: "17:00", workedMinutes: 290 }),
      ],
      BREAKS,
    );

    // Khoang nghi 5 + 10 = 15 phut -> con 45, nhan ty le 525/540 -> 44 phut.
    expect(day.breakMinutes).toBe(44);
    expect(day.workedMinutes).toBe(525 - 44);
  });

  it("19. con luot dang mo -> chua tru gio nghi (so gio khong duoc tut xuong roi tang lai)", () => {
    const [day] = groupAttendanceByDay(
      [
        punch({ id: "att-01", checkIn: "08:00", checkOut: "11:30", workedMinutes: 210 }),
        punch({ id: "att-02", checkIn: "12:35", checkOut: null, workedMinutes: 0 }),
      ],
      BREAKS,
    );

    expect(day.breakMinutes).toBe(0);
    expect(day.workedMinutes).toBe(210);
  });

  it("20. khong biet ca -> KHONG tru gi ca (thieu du lieu khong duoc thanh phep tru bia ra)", () => {
    const [day] = groupAttendanceByDay(
      [punch({ checkIn: "08:00", checkOut: "17:00", workedMinutes: 540 })],
      {},
    );

    expect(day.breakMinutes).toBe(0);
    expect(day.workedMinutes).toBe(540);
  });

  it("21. ca QUA DEM tinh dung do dai tron ca, khong ra so am", () => {
    const overnight = shiftBreakInfoById([
      { id: "sft-01", breakMinutes: 60, startTime: "22:00", endTime: "06:00" },
    ]);

    expect(overnight["sft-01"].shiftMinutes).toBe(480);
  });

  it("22. phan tru khong bao gio vuot thoi gian co mat, nen so gio duoc tinh cong khong am", () => {
    const shortShift = { breakMinutes: 600, shiftMinutes: 10 };

    expect(
      breakToDeductMinutes({ shift: shortShift, rawMinutes: 5, gapMinutes: 0 }),
    ).toBe(5);
  });

  it("23. khoang nghi dai hon ca gio nghi cua ca -> khong tru gi, khong ra so am", () => {
    expect(
      breakToDeductMinutes({
        shift: { breakMinutes: 60, shiftMinutes: 540 },
        rawMinutes: 400,
        gapMinutes: 200,
      }),
    ).toBe(0);
  });
});

describe("getAttendanceDay — lay dung mot ngay", () => {
  it("11. tra ve ban tom tat cua dung ngay duoc hoi, bo qua ngay khac", () => {
    const day = getAttendanceDay(
      [
        punch({ id: "att-01", date: "2026-08-04", workedMinutes: 480 }),
        punch({ id: "att-02", date: "2026-08-05", workedMinutes: 328 }),
        punch({
          id: "att-03",
          date: "2026-08-05",
          checkIn: "12:35",
          checkOut: "14:05",
          workedMinutes: 90,
        }),
      ],
      "2026-08-05",
    );

    expect(day?.workedMinutes).toBe(418);
  });

  it("12. ngay khong co ban ghi nao tra ve null, KHONG nem loi", () => {
    expect(getAttendanceDay([punch()], "2026-08-01")).toBeNull();
  });
});
