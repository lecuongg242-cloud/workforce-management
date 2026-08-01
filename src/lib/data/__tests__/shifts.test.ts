import { afterEach, describe, expect, it, vi } from "vitest";

import { listShifts } from "@/lib/data/shifts";
import { shiftRowSchema } from "@/lib/validation/api/shifts";

/**
 * Bay bien kieu du lieu cua ca lam viec (plan 02-06):
 * - Nhom 1, 4, 5, 6 kiem chung ba phep bien doi nam trong `shiftRowSchema`
 *   (dong tho DB, snake_case + giay -> `Shift` camelCase + "HH:mm") — day la
 *   khuon Route Handler dung o `loadShiftsForCompany`
 *   (`src/app/api/shifts/route.ts`), nen test truc tiep vao schema thay vi
 *   qua `fetch` gia lap.
 * - Nhom 2, 3, 7 kiem chung `listShifts()` (qua `fetch` gia lap bang
 *   `vi.stubGlobal`, dung khuon `departments.test.ts` cua 02-05): du lieu
 *   mo phong dung hinh dang cuoi cung tren day (`shiftWithStatsSchema`,
 *   camelCase, khong transform) ma `fetchJson` nhan duoc qua HTTP.
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

const rawShiftRow = {
  id: "sft-01",
  company_id: "cty-01",
  name: "Ca hành chính",
  code: "CA-HC",
  start_time: "08:00:00",
  end_time: "17:30:00",
  break_minutes: 60,
  late_tolerance_minutes: 5,
  overnight: false,
  working_days: [1, 2, 3, 4, 5],
  status: "active" as const,
};

const finalShift = {
  id: "sft-01",
  companyId: "cty-01",
  name: "Ca hành chính",
  code: "CA-HC",
  startTime: "08:00",
  endTime: "17:30",
  breakMinutes: 60,
  lateToleranceMinutes: 5,
  overnight: false,
  workingDays: [1, 2, 3, 4, 5],
  status: "active" as const,
  employeeCount: 0,
};

describe("shiftRowSchema — bien doi dong DB (snake_case + giay) -> domain (camelCase + HH:mm)", () => {
  it("1. start_time dạng '08:00:00' -> startTime bằng '08:00' (Postgres time khác định dạng giao diện)", () => {
    const result = shiftRowSchema.parse(rawShiftRow);

    expect(result.startTime).toBe("08:00");
    expect(result.endTime).toBe("17:30");
  });

  it("4. working_days bằng [1,2,3,4,5] -> workingDays bằng đúng [1,2,3,4,5], cùng thứ tự", () => {
    const result = shiftRowSchema.parse(rawShiftRow);

    expect(result.workingDays).toEqual([1, 2, 3, 4, 5]);
  });

  it("5. working_days chứa giá trị ngoài khoảng 1..7 -> ném Error, không trả về giá trị chưa kiểm", () => {
    const bad = { ...rawShiftRow, working_days: [1, 2, 8] };

    try {
      shiftRowSchema.parse(bad);
      expect.fail("Kỳ vọng schema ném lỗi nhưng không ném.");
    } catch (cause) {
      expect(cause).toBeInstanceOf(Error);
    }
  });

  it("6. working_days là mảng rỗng -> ném Error (ràng buộc CHECK của database đòi ít nhất một phần tử)", () => {
    const bad = { ...rawShiftRow, working_days: [] };

    try {
      shiftRowSchema.parse(bad);
      expect.fail("Kỳ vọng schema ném lỗi nhưng không ném.");
    } catch (cause) {
      expect(cause).toBeInstanceOf(Error);
    }
  });
});

describe("listShifts — cấm tính lại cột sinh overnight ở tầng ứng dụng (T-02-06-04)", () => {
  it("2. overnight: true trong phản hồi -> kết quả overnight bằng true, lấy từ phản hồi", async () => {
    stubFetchOnce({
      ok: true,
      json: async () => [
        { ...finalShift, startTime: "22:00", endTime: "06:00", overnight: true },
      ],
    });

    const result = await listShifts("cty-01");

    expect(result[0].overnight).toBe(true);
  });

  it("3. overnight: false dù endTime < startTime (mâu thuẫn nhân tạo) -> kết quả vẫn false, KHÔNG được tính lại", async () => {
    stubFetchOnce({
      ok: true,
      json: async () => [
        { ...finalShift, startTime: "22:00", endTime: "06:00", overnight: false },
      ],
    });

    const result = await listShifts("cty-01");

    expect(result[0].overnight).toBe(false);
  });

  it("7. phản hồi 200 với mảng rỗng -> trả [] và KHÔNG ném (edge DATA-05 empty)", async () => {
    stubFetchOnce({ ok: true, json: async () => [] });

    const result = await listShifts("cty-01");

    expect(result).toEqual([]);
  });
});
