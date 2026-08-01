import { afterEach, describe, expect, it, vi } from "vitest";

import { getMonthlySummary, listAttendance } from "@/lib/data/attendance";
import { attendanceRecordSchema } from "@/lib/validation/api/attendance";

/**
 * Bon nhom khang dinh (plan 02-08):
 * - `attendanceRecordSchema` (dong tho DB) chuyen dung timestamptz -> "HH:mm"
 *   theo gio Viet Nam, va giu nguyen `null` cho gio ra chua cham (khong
 *   thanh chuoi rong) — day la khuon Route Handler dung o
 *   `src/app/api/attendance/route.ts`, nen test truc tiep vao schema thay vi
 *   qua `fetch` gia lap (dung khuon `shiftRowSchema` cua 02-06).
 * - `listAttendance`/`getMonthlySummary` (qua `fetch` gia lap bang
 *   `vi.stubGlobal`, dung khuon `departments.test.ts`/`shifts.test.ts`):
 *   thang khong co ban ghi tra ve `[]`/toan so 0 (edge DATA-05 empty).
 */

function stubFetchOnce(response: { ok: boolean; json: () => Promise<unknown> }): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: response.ok,
      json: response.json,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const rawAttendanceRow = {
  id: "att-01",
  company_id: "cty-01",
  employee_id: "emp-01",
  work_date: "2026-08-01",
  shift_id: "sft-01",
  check_in_at: "2026-08-01T01:05:00+00:00",
  check_out_at: null as string | null,
  worked_minutes: 0,
  late_minutes: 0,
  early_leave_minutes: 0,
  status: "on_time" as const,
  location: "Văn phòng chính",
  needs_supplement: false,
  note: null as string | null,
};

describe("attendanceRecordSchema — chuyen dung timestamptz -> HH:mm theo gio Viet Nam", () => {
  it("1. check_in_at = '2026-08-01T01:05:00+00:00' (UTC) -> checkIn = '08:05' (gio VN, UTC+7)", () => {
    const result = attendanceRecordSchema.parse(rawAttendanceRow);

    expect(result.checkIn).toBe("08:05");
  });

  it("2. check_out_at = null -> checkOut giu nguyen null, KHONG thanh chuoi rong", () => {
    const result = attendanceRecordSchema.parse(rawAttendanceRow);

    expect(result.checkOut).toBeNull();
  });

  it("3. work_date giu nguyen dang 'YYYY-MM-DD' -> date bang dung work_date, khong bien doi", () => {
    const result = attendanceRecordSchema.parse(rawAttendanceRow);

    expect(result.date).toBe("2026-08-01");
  });
});

describe("listAttendance — thang khong co ban ghi nao (edge DATA-05 empty)", () => {
  it("4. phan hoi 200 voi mang rong -> tra [] va KHONG nem", async () => {
    stubFetchOnce({ ok: true, json: async () => [] });

    const result = await listAttendance({
      companyId: "cty-01",
      employeeId: "emp-01",
      month: "2099-01",
    });

    expect(result).toEqual([]);
  });
});

describe("getMonthlySummary — thang khong co ban ghi nao tra ve TOAN SO 0 (edge DATA-05 empty)", () => {
  it("5. tra { month, workedDays:0, totalMinutes:0, lateCount:0, leaveDays:0 } dung bang tham so month, KHONG phai null va KHONG nem loi", async () => {
    stubFetchOnce({
      ok: true,
      json: async () => ({
        month: "2099-01",
        workedDays: 0,
        totalMinutes: 0,
        lateCount: 0,
        leaveDays: 0,
      }),
    });

    const result = await getMonthlySummary("cty-01", "emp-01", "2099-01");

    expect(result).toEqual({
      month: "2099-01",
      workedDays: 0,
      totalMinutes: 0,
      lateCount: 0,
      leaveDays: 0,
    });
  });
});
