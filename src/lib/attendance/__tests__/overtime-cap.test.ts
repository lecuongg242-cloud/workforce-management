import { describe, expect, it } from "vitest";

import {
  capUsageSummary,
  isOverCap,
  requestedOvertimeHours,
} from "@/lib/attendance/overtime-cap";

/**
 * Mo-dun thuan cua tran tang ca (SET-05, plan 05-03).
 *
 * Hai bien quan trong nhat cua ca file:
 *   - `capHours === null` (chua khai tran) KHONG BAO GIO sinh canh bao. Neu
 *     bien nay sai, moi lan duyet deu canh bao va nguoi duyet se ngung doc
 *     canh bao — ke ca canh bao that (T-05-03-01).
 *   - Tong BANG DUNG tran khong phai la vuot. Canh bao o dung con so tran lam
 *     nguoi duyet thay he thong dem sai, va do la cach nhanh nhat de ho mat
 *     long tin vao moi con so con lai.
 */

describe("isOverCap — trần để trống nghĩa là không giới hạn", () => {
  it("1. capHours null -> KHÔNG bao giờ vượt, dù dùng bao nhiêu", () => {
    expect(isOverCap({ usedHours: 0, requestedHours: 0, capHours: null })).toBe(false);
    expect(isOverCap({ usedHours: 900, requestedHours: 100, capHours: null })).toBe(
      false,
    );
  });

  it("2. trần null KHÁC trần 0: cùng dữ liệu, một bên im lặng, một bên cảnh báo", () => {
    const usage = { usedHours: 1, requestedHours: 0 };
    expect(isOverCap({ ...usage, capHours: null })).toBe(false);
    // (0 khong phai gia tri hop le o database — bai nay chi de khang dinh hai
    // gia tri KHONG duoc gop lam mot o tang quyet dinh.)
    expect(isOverCap({ ...usage, capHours: 0 })).toBe(true);
  });
});

describe("isOverCap — biên bằng đúng trần", () => {
  it("3. tổng bằng ĐÚNG trần -> không vượt", () => {
    expect(isOverCap({ usedHours: 36, requestedHours: 4, capHours: 40 })).toBe(false);
  });

  it("4. vượt trần dù chỉ một phần giờ -> vượt", () => {
    expect(isOverCap({ usedHours: 36, requestedHours: 4.5, capHours: 40 })).toBe(true);
  });

  it("5. đã vượt sẵn từ trước, yêu cầu này thêm 0 giờ -> vẫn vượt", () => {
    expect(isOverCap({ usedHours: 41, requestedHours: 0, capHours: 40 })).toBe(true);
  });
});

describe("capUsageSummary — bốn con số của cảnh báo", () => {
  it("6. trả đủ đã dùng / yêu cầu thêm / trần / phần vượt", () => {
    const summary = capUsageSummary({
      usedHours: 18,
      requestedHours: 4,
      capHours: 20,
    });

    expect(summary).toEqual({
      usedHours: 18,
      requestedHours: 4,
      capHours: 20,
      totalHours: 22,
      overHours: 2,
      isOver: true,
    });
  });

  it("7. không vượt -> overHours bằng 0, không phải số âm", () => {
    const summary = capUsageSummary({
      usedHours: 10,
      requestedHours: 2,
      capHours: 40,
    });

    expect(summary.isOver).toBe(false);
    expect(summary.overHours).toBe(0);
  });

  it("8. trần null -> overHours 0 và capHours giữ nguyên null (không đổi thành 0)", () => {
    const summary = capUsageSummary({
      usedHours: 99,
      requestedHours: 9,
      capHours: null,
    });

    expect(summary.isOver).toBe(false);
    expect(summary.overHours).toBe(0);
    expect(summary.capHours).toBeNull();
  });
});

describe("requestedOvertimeHours — số giờ đăng ký của một yêu cầu", () => {
  it("9. hai mốc giờ -> số giờ giữa chúng", () => {
    expect(requestedOvertimeHours("18:00", "21:00")).toBe(3);
    expect(requestedOvertimeHours("18:30", "21:00")).toBe(2.5);
  });

  it("10. thiếu giờ (yêu cầu không khai) -> 0, không phải NaN", () => {
    expect(requestedOvertimeHours(null, null)).toBe(0);
    expect(requestedOvertimeHours("18:00", null)).toBe(0);
    expect(requestedOvertimeHours(null, "21:00")).toBe(0);
  });

  it("11. qua nửa đêm -> tính vòng qua ngày hôm sau, không ra số âm", () => {
    expect(requestedOvertimeHours("22:00", "02:00")).toBe(4);
  });
});
