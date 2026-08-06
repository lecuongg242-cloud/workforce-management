import { describe, expect, it } from "vitest";

import {
  PERIOD_CLOSED_SQLSTATE,
  isPeriodClosedError,
  periodGuardError,
} from "@/lib/attendance/period-guard";

/**
 * Lop dich loi cua trigger ky da chot (PERD-02, plan 05-05).
 *
 * Bai kiem quan trong nhat la bai cuoi: mot loi Postgres KHAC khong duoc lot
 * nguyen van len giao dien. Nhan vien cham cong khong can biet ten rang buoc
 * nao vua no — va mot chuoi loi tho con lam lo ca ten bang lan ten cot.
 */

/** Thong diep that ma trigger `attendance_period_guard` nem ra. */
const TRIGGER_MESSAGE =
  "Kỳ công tháng 04/2015 đã chốt. Dữ liệu chấm công của kỳ này chỉ thay đổi được qua một yêu cầu được duyệt.";

describe("isPeriodClosedError — nhận đúng lỗi của trigger", () => {
  it("1. mã TF001 -> đúng là lỗi kỳ đã chốt", () => {
    expect(isPeriodClosedError({ code: PERIOD_CLOSED_SQLSTATE })).toBe(true);
  });

  it("2. mã khác / không có lỗi -> không phải", () => {
    expect(isPeriodClosedError({ code: "23505" })).toBe(false);
    expect(isPeriodClosedError({ code: "23001" })).toBe(false);
    expect(isPeriodClosedError(null)).toBe(false);
    expect(isPeriodClosedError(undefined)).toBe(false);
  });
});

describe("periodGuardError — câu nói được, không phải lỗi Postgres thô", () => {
  it("3. lỗi của trigger -> giữ nguyên thông điệp (kèm tháng của kỳ) và nói tiếp phải làm gì", () => {
    const error = periodGuardError(
      { code: PERIOD_CLOSED_SQLSTATE, message: TRIGGER_MESSAGE },
      "Không thể ghi nhận giờ vào ca.",
    );

    expect(error.message).toContain("đã chốt");
    expect(error.message).toContain("04/2015");
    expect(error.message).toContain("yêu cầu bổ sung công");
  });

  it("4. lỗi Postgres KHÁC -> thông điệp mặc định của nơi gọi, KHÔNG lộ chuỗi lỗi thô", () => {
    const raw =
      'duplicate key value violates unique constraint "attendance_records_pkey"';
    const error = periodGuardError({ code: "23505", message: raw }, "Không thể ghi nhận giờ vào ca.");

    expect(error.message).toBe("Không thể ghi nhận giờ vào ca.");
    expect(error.message).not.toContain("constraint");
    expect(error.message).not.toContain("attendance_records");
  });

  it("5. không có lỗi (chỉ thiếu dữ liệu trả về) -> thông điệp mặc định", () => {
    expect(periodGuardError(null, "Không thể ghi nhận giờ tan ca.").message).toBe(
      "Không thể ghi nhận giờ tan ca.",
    );
  });
});
