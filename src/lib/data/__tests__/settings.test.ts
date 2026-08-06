import { afterEach, describe, expect, it, vi } from "vitest";

import { getCompanySettings } from "@/lib/data/settings";
import {
  companySettingsInputSchema,
  companySettingsRowSchema,
} from "@/lib/validation/api/settings";

/**
 * Cau hinh doanh nghiep (plan 04-01), cung khuon `work-sites.test.ts`:
 * - Nhom 1: phep bien doi cua `companySettingsRowSchema` (dong tho DB ->
 *   hinh dang domain), gom ca viec cat "HH:mm:ss" cua Postgres ve "HH:mm".
 * - Nhom 2: `companySettingsInputSchema` chan gia tri vo ly TRUOC khi cham
 *   database (khop dung rang buoc CHECK cua migration 0015) va khong nhan
 *   truong dinh danh doanh nghiep nao (D-12b).
 * - Nhom 3: `getCompanySettings()` qua `fetch` gia lap.
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

const rawSettingsRow = {
  company_id: "cty-01",
  suspicious_distance_multiplier: 5,
  shift_window_grace_minutes: 120,
  night_start_time: "22:00:00",
  night_end_time: "06:00:00",
  overtime_cap_hours_per_month: null,
  work_mode: "shift",
  standard_hours_per_day: null,
  standard_days_per_month: null,
  updated_at: "2026-08-06T02:00:00.000Z",
  updated_by: null,
};

const finalSettings = {
  companyId: "cty-01",
  suspiciousDistanceMultiplier: 5,
  shiftWindowGraceMinutes: 120,
  nightStartTime: "22:00",
  nightEndTime: "06:00",
  overtimeCapHoursPerMonth: null,
  workMode: "shift" as const,
  standardHoursPerDay: null,
  standardDaysPerMonth: null,
  updatedAt: "2026-08-06T02:00:00.000Z",
  updatedBy: null,
};

describe("companySettingsRowSchema — dòng DB (snake_case) -> domain (camelCase)", () => {
  it("1. đổi tên trường và cắt 'HH:mm:ss' của Postgres về 'HH:mm'", () => {
    const result = companySettingsRowSchema.parse(rawSettingsRow);

    expect(result).toEqual(finalSettings);
  });

  it("2. numeric trả về dạng chuỗi (tuỳ driver PostgREST) vẫn ra số", () => {
    const result = companySettingsRowSchema.parse({
      ...rawSettingsRow,
      suspicious_distance_multiplier: "7.50",
    });

    expect(result.suspiciousDistanceMultiplier).toBe(7.5);
  });
});

describe("companySettingsInputSchema — chặn giá trị vô lý trước khi chạm database", () => {
  it("3. ngưỡng đáng ngờ bằng 0 bị từ chối (CHECK > 0)", () => {
    expect(() =>
      companySettingsInputSchema.parse({ suspiciousDistanceMultiplier: 0 }),
    ).toThrow();
  });

  it("4. ngưỡng đáng ngờ âm bị từ chối", () => {
    expect(() =>
      companySettingsInputSchema.parse({ suspiciousDistanceMultiplier: -1 }),
    ).toThrow();
  });

  it("5. biên độ khung giờ ca âm bị từ chối, bằng 0 thì hợp lệ", () => {
    expect(() =>
      companySettingsInputSchema.parse({ shiftWindowGraceMinutes: -1 }),
    ).toThrow();
    expect(
      companySettingsInputSchema.parse({ shiftWindowGraceMinutes: 0 })
        .shiftWindowGraceMinutes,
    ).toBe(0);
  });

  it("6. giờ ca đêm sai định dạng bị từ chối", () => {
    expect(() =>
      companySettingsInputSchema.parse({ nightStartTime: "25:00" }),
    ).toThrow();
    expect(() =>
      companySettingsInputSchema.parse({ nightStartTime: "22h" }),
    ).toThrow();
  });

  it("7. patch từng phần: chỉ gửi một trường vẫn hợp lệ và không sinh trường nào khác", () => {
    const result = companySettingsInputSchema.parse({
      shiftWindowGraceMinutes: 45,
    });

    expect(result).toEqual({ shiftWindowGraceMinutes: 45 });
  });

  it("8. trường định danh doanh nghiệp bị loại bỏ, không bao giờ tới được đường ghi (D-12b)", () => {
    const result = companySettingsInputSchema.parse({
      shiftWindowGraceMinutes: 45,
      companyId: "cty-02",
      company_id: "cty-02",
    } as Record<string, unknown>);

    expect(result).not.toHaveProperty("companyId");
    expect(result).not.toHaveProperty("company_id");
  });
});

describe("companySettingsInputSchema — trần tăng ca để trống là câu trả lời hợp lệ (SET-05)", () => {
  it("11. `null` được chấp nhận và giữ nguyên `null` — 'không giới hạn', không bị ép về 0", () => {
    const result = companySettingsInputSchema.parse({
      overtimeCapHoursPerMonth: null,
    });

    expect(result).toEqual({ overtimeCapHoursPerMonth: null });
    expect(result.overtimeCapHoursPerMonth).not.toBe(0);
  });

  it("12. trần bằng 0 hoặc âm bị từ chối (CHECK > 0) — 0 không phải một trần hợp lệ", () => {
    expect(() =>
      companySettingsInputSchema.parse({ overtimeCapHoursPerMonth: 0 }),
    ).toThrow();
    expect(() =>
      companySettingsInputSchema.parse({ overtimeCapHoursPerMonth: -5 }),
    ).toThrow();
  });

  it("13. `null` (xoá trần) và không gửi trường (giữ nguyên) là HAI trường hợp khác nhau", () => {
    // Truong CO mat mang gia tri null -> duong ghi phai ap dung no.
    expect(
      "overtimeCapHoursPerMonth" in
        companySettingsInputSchema.parse({ overtimeCapHoursPerMonth: null }),
    ).toBe(true);
    // Truong KHONG co mat -> duong ghi giu nguyen gia tri cu.
    expect(
      "overtimeCapHoursPerMonth" in
        companySettingsInputSchema.parse({ shiftWindowGraceMinutes: 45 }),
    ).toBe(false);
  });

  it("14. dòng DB có trần -> ra số; numeric dạng chuỗi vẫn ra số", () => {
    expect(
      companySettingsRowSchema.parse({
        ...rawSettingsRow,
        overtime_cap_hours_per_month: "40.00",
      }).overtimeCapHoursPerMonth,
    ).toBe(40);
  });
});

describe("companySettingsInputSchema — cách tính công và hai mẫu số quy đổi (D-36/D-38)", () => {
  it("15. `work_mode` chỉ nhận đúng ba giá trị đã khai", () => {
    for (const mode of ["daily_hours", "shift", "shift_hourly"] as const) {
      expect(companySettingsInputSchema.parse({ workMode: mode }).workMode).toBe(mode);
    }
    expect(() =>
      companySettingsInputSchema.parse({ workMode: "theo_tuan" }),
    ).toThrow();
  });

  it("16. hai mẫu số ĐỂ TRỐNG (`null`) là câu trả lời hợp lệ — 'chưa khai', không bị ép về 0 (D-38)", () => {
    const result = companySettingsInputSchema.parse({
      standardHoursPerDay: null,
      standardDaysPerMonth: null,
    });

    expect(result).toEqual({
      standardHoursPerDay: null,
      standardDaysPerMonth: null,
    });
    expect(result.standardHoursPerDay).not.toBe(0);
    expect(result.standardDaysPerMonth).not.toBe(0);
  });

  it("17. mẫu số bằng 0 hoặc âm bị từ chối — 0 không phải 'chưa khai', nó là một mẫu số vô nghĩa", () => {
    expect(() =>
      companySettingsInputSchema.parse({ standardHoursPerDay: 0 }),
    ).toThrow();
    expect(() =>
      companySettingsInputSchema.parse({ standardDaysPerMonth: -1 }),
    ).toThrow();
  });

  it("18. `null` (xoá mẫu số) và không gửi trường (giữ nguyên) là HAI trường hợp khác nhau", () => {
    expect(
      "standardDaysPerMonth" in
        companySettingsInputSchema.parse({ standardDaysPerMonth: null }),
    ).toBe(true);
    expect(
      "standardDaysPerMonth" in
        companySettingsInputSchema.parse({ shiftWindowGraceMinutes: 45 }),
    ).toBe(false);
  });

  it("19. dòng DB chưa khai mẫu số -> `null`, KHÔNG phải một con số đoán ra (D-26)", () => {
    const result = companySettingsRowSchema.parse(rawSettingsRow);

    expect(result.standardHoursPerDay).toBeNull();
    expect(result.standardDaysPerMonth).toBeNull();
    // Va `work_mode` thi NGUOC LAI: luon co gia tri, mac dinh `shift`.
    expect(result.workMode).toBe("shift");
  });

  it("20. numeric dạng chuỗi của mẫu số vẫn ra số", () => {
    const result = companySettingsRowSchema.parse({
      ...rawSettingsRow,
      work_mode: "daily_hours",
      standard_hours_per_day: "10.00",
      standard_days_per_month: "26.00",
    });

    expect(result.workMode).toBe("daily_hours");
    expect(result.standardHoursPerDay).toBe(10);
    expect(result.standardDaysPerMonth).toBe(26);
  });
});

describe("getCompanySettings — qua fetch giả lập", () => {
  it("9. phản hồi 200 -> trả đúng hình dạng domain", async () => {
    stubFetchOnce({ ok: true, json: async () => finalSettings });

    const result = await getCompanySettings();

    expect(result).toEqual(finalSettings);
  });

  it("10. phản hồi lỗi -> ném Error mang thông điệp tiếng Việt của server", async () => {
    stubFetchOnce({
      ok: false,
      json: async () => ({ error: "Bạn không có quyền thực hiện thao tác này." }),
    });

    await expect(getCompanySettings()).rejects.toThrow(
      "Bạn không có quyền thực hiện thao tác này.",
    );
  });
});
