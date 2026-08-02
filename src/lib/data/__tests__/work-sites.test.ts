import { afterEach, describe, expect, it, vi } from "vitest";

import { listWorkSites } from "@/lib/data/work-sites";
import { workSiteInputSchema, workSiteRowSchema } from "@/lib/validation/api/work-sites";

/**
 * Bay bien kieu du lieu cua diem lam viec (plan 03-02), cung khuon
 * `shifts.test.ts` (02-06):
 * - Nhom 1 kiem chung phep bien doi nam trong `workSiteRowSchema` (dong tho
 *   DB, snake_case -> `WorkSite` camelCase) — day la khuon Route Handler
 *   dung o `loadWorkSitesForCompany` (`src/app/api/work-sites/route.ts`),
 *   nen test truc tiep vao schema thay vi qua `fetch` gia lap.
 * - Nhom 2 kiem chung `workSiteInputSchema` tu choi toa do/ban kinh vo ly
 *   truoc khi cham database (khop dung rang buoc CHECK cua
 *   `supabase/migrations/0005_v2_tables.sql`).
 * - Nhom 3 kiem chung `listWorkSites()` (qua `fetch` gia lap bang
 *   `vi.stubGlobal`, dung khuon `shifts.test.ts`).
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

const rawWorkSiteRow = {
  id: "wst-01",
  company_id: "cty-01",
  name: "Văn phòng chính",
  latitude: 10.762622,
  longitude: 106.660172,
  radius_meters: 100,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
};

const finalWorkSite = {
  id: "wst-01",
  companyId: "cty-01",
  name: "Văn phòng chính",
  latitude: 10.762622,
  longitude: 106.660172,
  radiusMeters: 100,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const validWriteInput = {
  name: "Văn phòng chính",
  latitude: 10.762622,
  longitude: 106.660172,
  radiusMeters: 100,
  isActive: true,
};

describe("workSiteRowSchema — bien doi dong DB (snake_case) -> domain (camelCase)", () => {
  it("1. radius_meters -> radiusMeters, is_active -> isActive, giữ latitude/longitude ở dạng số", () => {
    const result = workSiteRowSchema.parse(rawWorkSiteRow);

    expect(result.radiusMeters).toBe(100);
    expect(result.isActive).toBe(true);
    expect(result.latitude).toBe(10.762622);
    expect(result.longitude).toBe(106.660172);
  });
});

describe("workSiteInputSchema — chặn toạ độ/bán kính vô lý trước khi chạm database (khớp CHECK)", () => {
  it("2. vĩ độ nhỏ hơn -90 bị từ chối", () => {
    expect(() =>
      workSiteInputSchema.parse({ ...validWriteInput, latitude: -91 }),
    ).toThrow();
  });

  it("3. vĩ độ lớn hơn 90 bị từ chối", () => {
    expect(() =>
      workSiteInputSchema.parse({ ...validWriteInput, latitude: 91 }),
    ).toThrow();
  });

  it("4. kinh độ nhỏ hơn -180 bị từ chối", () => {
    expect(() =>
      workSiteInputSchema.parse({ ...validWriteInput, longitude: -181 }),
    ).toThrow();
  });

  it("5. kinh độ lớn hơn 180 bị từ chối", () => {
    expect(() =>
      workSiteInputSchema.parse({ ...validWriteInput, longitude: 181 }),
    ).toThrow();
  });

  it("6. bán kính bằng 0 bị từ chối", () => {
    expect(() =>
      workSiteInputSchema.parse({ ...validWriteInput, radiusMeters: 0 }),
    ).toThrow();
  });

  it("7. bán kính âm bị từ chối", () => {
    expect(() =>
      workSiteInputSchema.parse({ ...validWriteInput, radiusMeters: -10 }),
    ).toThrow();
  });

  it("8. đầu vào hợp lệ transform thành dòng snake_case sẵn sàng ghi, không có trường định danh doanh nghiệp", () => {
    const result = workSiteInputSchema.parse(validWriteInput);

    expect(result).toEqual({
      name: "Văn phòng chính",
      latitude: 10.762622,
      longitude: 106.660172,
      radius_meters: 100,
      is_active: true,
    });
    expect(result).not.toHaveProperty("company_id");
    expect(result).not.toHaveProperty("companyId");
  });
});

describe("listWorkSites — qua fetch giả lập", () => {
  it("9. phản hồi 200 với mảng rỗng -> trả [] và KHÔNG ném (edge DATA-05 empty)", async () => {
    stubFetchOnce({ ok: true, json: async () => [] });

    const result = await listWorkSites("cty-01");

    expect(result).toEqual([]);
  });

  it("10. phản hồi gồm điểm đã ngừng sử dụng (isActive: false) -> giữ nguyên cờ, không lọc bỏ", async () => {
    stubFetchOnce({
      ok: true,
      json: async () => [{ ...finalWorkSite, isActive: false }],
    });

    const result = await listWorkSites("cty-01");

    expect(result[0].isActive).toBe(false);
  });
});
