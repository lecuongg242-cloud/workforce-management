import { afterEach, describe, expect, it, vi } from "vitest";

import { listHolidays } from "@/lib/data/holidays";
import {
  holidayInputSchema,
  holidayQuerySchema,
  holidayRowSchema,
} from "@/lib/validation/api/holidays";

/**
 * Ngay nghi le (SET-02, plan 04-03), khuon `work-sites.test.ts`:
 * - Nhom 1: phep bien doi cua `holidayRowSchema`.
 * - Nhom 2: `holidayInputSchema` / `holidayQuerySchema` chan du lieu vo ly
 *   truoc khi cham database, va khong nhan truong dinh danh doanh nghiep nao.
 * - Nhom 3: `listHolidays()` qua `fetch` gia lap — gom ca truong hop nam rong
 *   (bang co y de rong khi doanh nghiep khoi tao, D-26).
 */

function stubFetch(response: { ok: boolean; json: () => Promise<unknown> }) {
  const spy = vi.fn().mockResolvedValue({ ok: response.ok, json: response.json });
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const rawHolidayRow = {
  id: "11111111-1111-1111-1111-111111111111",
  company_id: "cty-01",
  holiday_date: "2026-09-02",
  name: "Quốc khánh",
};

const finalHoliday = {
  id: "11111111-1111-1111-1111-111111111111",
  companyId: "cty-01",
  date: "2026-09-02",
  name: "Quốc khánh",
};

describe("holidayRowSchema — dòng DB (snake_case) -> domain (camelCase)", () => {
  it("1. holiday_date -> date, company_id -> companyId", () => {
    expect(holidayRowSchema.parse(rawHolidayRow)).toEqual(finalHoliday);
  });
});

describe("holidayInputSchema / holidayQuerySchema — chặn dữ liệu vô lý", () => {
  it("2. ngày sai định dạng bị từ chối", () => {
    expect(() =>
      holidayInputSchema.parse({ date: "02/09/2026", name: "Quốc khánh" }),
    ).toThrow();
  });

  it("3. tên rỗng hoặc chỉ khoảng trắng bị từ chối", () => {
    expect(() => holidayInputSchema.parse({ date: "2026-09-02", name: "" })).toThrow();
    expect(() =>
      holidayInputSchema.parse({ date: "2026-09-02", name: "   " }),
    ).toThrow();
  });

  it("4. đầu vào hợp lệ transform thành dòng snake_case, KHÔNG có trường định danh doanh nghiệp (D-12b)", () => {
    const result = holidayInputSchema.parse({
      date: "2026-09-02",
      name: "  Quốc khánh  ",
    });

    expect(result).toEqual({ holiday_date: "2026-09-02", name: "Quốc khánh" });
    expect(result).not.toHaveProperty("company_id");
    expect(result).not.toHaveProperty("companyId");
  });

  it("5. year không phải số bốn chữ số bị từ chối; không truyền year vẫn hợp lệ", () => {
    expect(() => holidayQuerySchema.parse({ year: "abcd" })).toThrow();
    expect(() => holidayQuerySchema.parse({ year: "12" })).toThrow();
    expect(holidayQuerySchema.parse({})).toEqual({});
    expect(holidayQuerySchema.parse({ year: "2026" })).toEqual({ year: 2026 });
  });
});

describe("listHolidays — qua fetch giả lập", () => {
  it("6. năm chưa khai ngày lễ nào -> trả [] và KHÔNG ném (bảng cố ý rỗng, D-26)", async () => {
    stubFetch({ ok: true, json: async () => [] });

    expect(await listHolidays(2026)).toEqual([]);
  });

  it("7. truyền year -> đi vào tham số truy vấn; không truyền -> không tham số nào", async () => {
    const spy = stubFetch({ ok: true, json: async () => [] });

    await listHolidays(2026);
    expect(spy).toHaveBeenCalledWith("/api/holidays?year=2026", expect.anything());

    await listHolidays();
    expect(spy).toHaveBeenLastCalledWith("/api/holidays", expect.anything());
  });

  it("8. phản hồi lỗi -> ném Error mang thông điệp tiếng Việt của server", async () => {
    stubFetch({
      ok: false,
      json: async () => ({ error: "Không thể tải danh sách ngày nghỉ lễ." }),
    });

    await expect(listHolidays(2026)).rejects.toThrow(
      "Không thể tải danh sách ngày nghỉ lễ.",
    );
  });
});
