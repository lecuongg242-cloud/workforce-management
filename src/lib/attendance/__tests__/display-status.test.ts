import { describe, expect, it } from "vitest";

import { displayAttendanceStatus } from "@/lib/attendance/display-status";
import type { AttendanceStatus } from "@/lib/types/domain";

/**
 * Trang thai HIEN THI cua mot ban ghi cham cong.
 *
 * Bai quan trong nhat la bai 3: mot ngay DA QUA ma chua cham ra khong phai
 * "đang làm việc" — nguoi do khong con lam viec, ho quen cham ra. Neu hai
 * truong hop do gop lam mot thi mot ngay hong se nam im mai mai.
 */

const TODAY = "2026-08-08";

function display(
  overrides: {
    status?: AttendanceStatus;
    checkIn?: string | null;
    checkOut?: string | null;
    date?: string;
  } = {},
) {
  return displayAttendanceStatus({
    status: overrides.status ?? "on_time",
    checkIn: overrides.checkIn === undefined ? "09:14" : overrides.checkIn,
    checkOut: overrides.checkOut === undefined ? null : overrides.checkOut,
    date: overrides.date ?? TODAY,
    today: TODAY,
  });
}

describe("displayAttendanceStatus", () => {
  it("1. hôm nay, đã chấm vào chưa chấm ra -> đang làm việc", () => {
    expect(display()).toBe("working");
  });

  it("2. đã chấm ra -> giữ nguyên trạng thái đã lưu", () => {
    expect(display({ checkOut: "17:30" })).toBe("on_time");
    expect(display({ status: "late", checkOut: "17:30" })).toBe("late");
  });

  it("3. ngày ĐÃ QUA mà chưa chấm ra -> thiếu giờ ra, KHÔNG phải đang làm việc", () => {
    expect(display({ date: "2026-08-07" })).toBe("missing_checkout");
  });

  it("4. đi muộn rồi chưa chấm ra -> vẫn là đang làm việc, phép đánh giá đúng giờ KHÔNG mất", () => {
    // Trang thai hien thi doi, nhung `status` da luu van la `late` — bang
    // luong va bao cao di muon van doc duoc no.
    const shown = display({ status: "late" });
    expect(shown).toBe("working");
  });

  it("5. dòng nghỉ phép (không có giờ vào) -> giữ nguyên, không có lần chấm ra để thiếu", () => {
    for (const status of ["leave_paid", "leave_unpaid", "day_off"] as const) {
      expect(display({ status, checkIn: null, date: "2026-08-01" })).toBe(status);
    }
  });

  it("6. bản ghi của ngày MAI (ca qua đêm) -> vẫn là đang làm việc", () => {
    // `date >= today` chu khong phai `=== today`: mot ca qua nua dem co the
    // sinh ban ghi mang ngay cong lon hon hom nay o vai truong hop bien.
    expect(display({ date: "2026-08-09" })).toBe("working");
  });
});
