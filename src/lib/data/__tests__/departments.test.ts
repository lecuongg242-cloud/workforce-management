import { afterEach, describe, expect, it, vi } from "vitest";

import { listDepartments } from "@/lib/data/departments";
import { listEmployees } from "@/lib/data/employees";

/**
 * Test hop dong loi (`fetchJson`, D-12e) va ranh gioi rong (DATA-05) cho
 * tang du lieu moi cua plan 02-05. Mot file chung cho `departments.ts` va
 * `employees.ts` de tranh trung lap mock (ca hai module chi la wrapper qua
 * `fetchJson`, nen ca hai deu ke thua cung mot hop dong). `vi.stubGlobal`
 * gia lap `fetch` — khong bao gio goi mang that trong Vitest.
 */

function stubFetchOnce(response: {
  ok: boolean;
  json: () => Promise<unknown>;
}): void {
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

describe("hop dong loi va ranh gioi rong cua tang du lieu (D-12d, D-12e, DATA-05)", () => {
  it("1. phan hoi 200 voi mang rong -> tra [] va KHONG nem (edge DATA-05 empty, listDepartments)", async () => {
    stubFetchOnce({ ok: true, json: async () => [] });

    const result = await listDepartments("cty-01");

    expect(result).toEqual([]);
  });

  it("2. phan hoi 200 voi Paginated rong -> items rong, total 0, totalPages 1 (listEmployees)", async () => {
    stubFetchOnce({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      }),
    });

    const result = await listEmployees({ companyId: "cty-01" });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("3. phan hoi 500 kem { error } -> nem Error voi message DUNG BANG thong diep do", async () => {
    stubFetchOnce({
      ok: false,
      json: async () => ({ error: "Bạn không có quyền truy cập doanh nghiệp này." }),
    });

    await expect(listDepartments("cty-01")).rejects.toThrow(
      "Bạn không có quyền truy cập doanh nghiệp này.",
    );
  });

  it("4. phan hoi 500 voi than khong dung hinh dang -> nem Error voi message tieng Viet khac rong, khong bao gio nem gia tri khong phai Error", async () => {
    stubFetchOnce({ ok: false, json: async () => ({ unexpected: "shape" }) });

    try {
      await listDepartments("cty-01");
      expect.fail("Ky vong ham nem loi nhung khong nem.");
    } catch (cause) {
      expect(cause).toBeInstanceOf(Error);
      expect((cause as Error).message.length).toBeGreaterThan(0);
    }
  });

  it("5. fetch nem loi mang -> nem Error voi message dung chuoi loi ket noi cua tang gia lap V1 (D-12e)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(listDepartments("cty-01")).rejects.toThrow(
      "Không thể kết nối tới máy chủ. Vui lòng thử lại.",
    );
  });

  it("6. phan hoi 200 nhung than sai hinh dang so voi schema -> nem Error ve dinh dang, KHONG tra ve gia tri chua kiem (D-12d)", async () => {
    stubFetchOnce({
      ok: true,
      json: async () => [{ notADepartment: true }],
    });

    try {
      await listDepartments("cty-01");
      expect.fail("Ky vong ham nem loi nhung khong nem.");
    } catch (cause) {
      expect(cause).toBeInstanceOf(Error);
      expect((cause as Error).message).toContain("định dạng");
    }
  });
});
