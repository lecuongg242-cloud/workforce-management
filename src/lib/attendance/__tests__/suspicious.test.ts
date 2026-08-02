import { describe, expect, it } from "vitest";

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
