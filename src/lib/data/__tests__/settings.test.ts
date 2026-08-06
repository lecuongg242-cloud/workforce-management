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
  updated_at: "2026-08-06T02:00:00.000Z",
  updated_by: null,
};

const finalSettings = {
  companyId: "cty-01",
  suspiciousDistanceMultiplier: 5,
  shiftWindowGraceMinutes: 120,
  nightStartTime: "22:00",
  nightEndTime: "06:00",
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
