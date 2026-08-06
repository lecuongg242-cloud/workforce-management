import { describe, expect, it } from "vitest";

import { isOutsideShiftWindow } from "@/lib/attendance/suspicious";

/**
 * Ngoai khung gio ca — tin hieu thu hai cua danh sach "Can xem lai". Truoc
 * day day la mot cua CHAN o `checkIn`; nay chi de HOI.
 *
 * Ca dung o nhom nay: 06:00-14:00, bien do mac dinh 120 phut -> khung
 * 04:00-16:00.
 */
describe("isOutsideShiftWindow — ca sang 06:00-14:00, bien do 120 phut", () => {
  const shift = { shiftStartTime: "06:00", shiftEndTime: "14:00" };

  it("dung truong hop da bay ra loi: cham luc 16:23 -> ngoai khung (qua han 23 phut)", () => {
    expect(isOutsideShiftWindow({ ...shift, punchTime: "16:23" })).toBe(true);
  });

  it("trong ca -> khong ngoai khung", () => {
    expect(isOutsideShiftWindow({ ...shift, punchTime: "09:30" })).toBe(false);
  });

  it("bien tren: dung 16:00 con trong khung, 16:01 da ra ngoai", () => {
    expect(isOutsideShiftWindow({ ...shift, punchTime: "16:00" })).toBe(false);
    expect(isOutsideShiftWindow({ ...shift, punchTime: "16:01" })).toBe(true);
  });

  it("bien duoi: dung 04:00 con trong khung, 03:59 da ra ngoai", () => {
    expect(isOutsideShiftWindow({ ...shift, punchTime: "04:00" })).toBe(false);
    expect(isOutsideShiftWindow({ ...shift, punchTime: "03:59" })).toBe(true);
  });

  it("ca QUA DEM 22:00-06:00: cham luc 02:00 (qua nua dem) van trong ca", () => {
    expect(
      isOutsideShiftWindow({
        punchTime: "02:00",
        shiftStartTime: "22:00",
        shiftEndTime: "06:00",
      }),
    ).toBe(false);
  });

  it("ca QUA DEM 22:00-06:00: cham luc 12:00 (giua trua) la ngoai khung", () => {
    expect(
      isOutsideShiftWindow({
        punchTime: "12:00",
        shiftStartTime: "22:00",
        shiftEndTime: "06:00",
      }),
    ).toBe(true);
  });

  it("bien do 0 -> chi trong dung khung gio ca moi khong bi danh dau", () => {
    expect(
      isOutsideShiftWindow({ ...shift, punchTime: "14:30", graceMinutes: 0 }),
    ).toBe(true);
    expect(
      isOutsideShiftWindow({ ...shift, punchTime: "13:59", graceMinutes: 0 }),
    ).toBe(false);
  });
});

import {
  SUSPICIOUS_DISTANCE_MULTIPLIER,
  isSuspiciousPunch,
  suspiciousMultiplier,
} from "@/lib/attendance/suspicious";

/**
 * Chin hanh vi cua `<behavior>` (03-06-PLAN.md Task 1) — bao gom hai truong
 * hop bien (bang dung nguong; ngoai ban kinh nhung chua toi nguong) va hai
 * truong hop thieu du lieu.
 */

describe("SUSPICIOUS_DISTANCE_MULTIPLIER", () => {
  it("1. bang 5 (D-21 mac dinh)", () => {
    expect(SUSPICIOUS_DISTANCE_MULTIPLIER).toBe(5);
  });
});

describe("isSuspiciousPunch", () => {
  it("2. khoang cach LON HON ban kinh nhan nguong, khong duoc phep tu xa -> true", () => {
    const result = isSuspiciousPunch({
      distanceMeters: 501,
      radiusMeters: 100,
      canCheckInRemotely: false,
    });
    expect(result).toBe(true);
  });

  it("3. cung du lieu nhung canCheckInRemotely=true -> false du khoang cach lon toi dau", () => {
    const result = isSuspiciousPunch({
      distanceMeters: 50_000,
      radiusMeters: 100,
      canCheckInRemotely: true,
    });
    expect(result).toBe(false);
  });

  it("4. distanceMeters=null -> false (chua do duoc thi khong ket luan gi)", () => {
    const result = isSuspiciousPunch({
      distanceMeters: null,
      radiusMeters: 100,
      canCheckInRemotely: false,
    });
    expect(result).toBe(false);
  });

  it("5. radiusMeters=null -> false (khong co moc thi khong co boi so)", () => {
    const result = isSuspiciousPunch({
      distanceMeters: 5000,
      radiusMeters: null,
      canCheckInRemotely: false,
    });
    expect(result).toBe(false);
  });

  it("6. radiusMeters=0 -> false", () => {
    const result = isSuspiciousPunch({
      distanceMeters: 5000,
      radiusMeters: 0,
      canCheckInRemotely: false,
    });
    expect(result).toBe(false);
  });

  it("7. khoang cach BANG DUNG ban kinh nhan nguong -> false (bien la 'qua xa', khong phai 'bang')", () => {
    const result = isSuspiciousPunch({
      distanceMeters: 500, // 100 * 5
      radiusMeters: 100,
      canCheckInRemotely: false,
    });
    expect(result).toBe(false);
  });

  it("8. khoang cach LON HON ban kinh nhung NHO HON ban kinh nhan nguong -> false (D-20: ngoai ban kinh khong du de dang ngo)", () => {
    const result = isSuspiciousPunch({
      distanceMeters: 150, // > 100 (ban kinh) nhung < 500 (nguong)
      radiusMeters: 100,
      canCheckInRemotely: false,
    });
    expect(result).toBe(false);
  });
});

/**
 * D-29 (plan 04-01): nguong den tu `company_settings` chu khong tu hang so.
 * Bon test duoi kiem chinh cai ban le do — hang so chi con la MAC DINH.
 */
describe("isSuspiciousPunch — nguong tu cau hinh doanh nghiep (D-29)", () => {
  it("12. nguong nho hon mac dinh -> mot lan cham truoc day 'sach' tro thanh dang ngo", () => {
    const input = {
      distanceMeters: 200, // 2 lan ban kinh
      radiusMeters: 100,
      canCheckInRemotely: false,
    };

    expect(isSuspiciousPunch(input)).toBe(false); // mac dinh 5 lan
    expect(isSuspiciousPunch({ ...input, multiplier: 1.5 })).toBe(true);
  });

  it("13. nguong lon hon mac dinh -> mot lan cham dang ngo tro lai binh thuong", () => {
    const input = {
      distanceMeters: 600, // 6 lan ban kinh
      radiusMeters: 100,
      canCheckInRemotely: false,
    };

    expect(isSuspiciousPunch(input)).toBe(true); // mac dinh 5 lan
    expect(isSuspiciousPunch({ ...input, multiplier: 10 })).toBe(false);
  });

  it("14. canCheckInRemotely van thang moi nguong — nguong nho toi dau cung khong keo ho vao danh sach", () => {
    expect(
      isSuspiciousPunch({
        distanceMeters: 50_000,
        radiusMeters: 100,
        canCheckInRemotely: true,
        multiplier: 0.1,
      }),
    ).toBe(false);
  });

  it("15. nguong <= 0 (du lieu cau hinh hong) -> false, khong bien MOI lan cham thanh dang ngo", () => {
    const input = {
      distanceMeters: 5_000,
      radiusMeters: 100,
      canCheckInRemotely: false,
    };

    expect(isSuspiciousPunch({ ...input, multiplier: 0 })).toBe(false);
    expect(isSuspiciousPunch({ ...input, multiplier: -3 })).toBe(false);
  });
});

describe("suspiciousMultiplier", () => {
  it("9. lam tron toi mot chu so thap phan", () => {
    expect(suspiciousMultiplier(620, 100)).toBe(6.2);
  });

  it("10. distanceMeters=null -> null", () => {
    expect(suspiciousMultiplier(null, 100)).toBeNull();
  });

  it("11. radiusMeters=null hoac 0 -> null", () => {
    expect(suspiciousMultiplier(620, null)).toBeNull();
    expect(suspiciousMultiplier(620, 0)).toBeNull();
  });
});
