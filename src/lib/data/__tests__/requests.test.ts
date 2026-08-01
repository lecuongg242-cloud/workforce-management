import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { listRequests } from "@/lib/data/requests";

/**
 * Nam nhom khang dinh (plan 02-09), muc (c) cua Task 2:
 * 1. Danh sach rong -> tra [], khong nem (edge DATA-05 empty).
 * 2. Server tra cac phan tu theo mot thu tu cu the -> ham giu nguyen thu tu
 *    do, khong sap lai o client.
 * 3. Goi hai lan tren cung du lieu -> cung thu tu.
 * 4. Server tra 403 -> ham nem Error voi thong diep tieng Viet ve quyen,
 *    khong nem gia tri khong phai Error.
 * 5. Khang dinh tinh: `route.ts` sap xep theo ca `created_at` VA mot cot
 *    tiebreaker, khong chi mot cot -- neu chi mot cot thi cac yeu cau trong
 *    seed (tao cung luc) se doi thu tu giua hai lan tai (T-02-09-06).
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

const rawRequests = [
  {
    id: "yc-02",
    companyId: "cty-01",
    employeeId: "nv-01a",
    type: "leave",
    status: "pending",
    fromDate: "2026-08-02",
    toDate: "2026-08-02",
    fromTime: null,
    toTime: null,
    reason: "Khám bệnh định kỳ.",
    createdAt: "2026-08-01T09:00:00+00:00",
    reviewerId: null,
    reviewNote: null,
  },
  {
    id: "yc-01",
    companyId: "cty-01",
    employeeId: "nv-01a",
    type: "overtime",
    status: "pending",
    fromDate: "2026-08-01",
    toDate: "2026-08-01",
    fromTime: "18:00",
    toTime: "20:00",
    reason: "Tăng ca hoàn thành báo cáo.",
    createdAt: "2026-08-01T09:00:00+00:00",
    reviewerId: null,
    reviewNote: null,
  },
];

describe("listRequests — thang/danh sach khong co ban ghi nao (edge DATA-05 empty)", () => {
  it("1. phan hoi 200 voi mang rong -> tra [] va KHONG nem", async () => {
    stubFetchOnce({ ok: true, json: async () => [] });

    const result = await listRequests({
      companyId: "cty-01",
      employeeId: "nv-01a",
    });

    expect(result).toEqual([]);
  });
});

describe("listRequests — giu nguyen thu tu server tra ve, khong sap lai o client", () => {
  it("2. server tra theo mot thu tu cu the -> ham giu nguyen thu tu do", async () => {
    stubFetchOnce({ ok: true, json: async () => rawRequests });

    const result = await listRequests({
      companyId: "cty-01",
      employeeId: "nv-01a",
    });

    expect(result.map((item) => item.id)).toEqual(["yc-02", "yc-01"]);
  });

  it("3. goi hai lan tren cung du lieu -> cung thu tu o moi lan goi", async () => {
    stubFetchOnce({ ok: true, json: async () => rawRequests });
    const first = await listRequests({ companyId: "cty-01", employeeId: "nv-01a" });

    stubFetchOnce({ ok: true, json: async () => rawRequests });
    const second = await listRequests({ companyId: "cty-01", employeeId: "nv-01a" });

    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
  });
});

describe("listRequests — server tra 403 (AUTH-03)", () => {
  it("4. nem Error voi thong diep tieng Viet ve quyen, khong nem gia tri khong phai Error", async () => {
    stubFetchOnce({
      ok: false,
      json: async () => ({
        error: "Bạn không có quyền thực hiện thao tác này.",
      }),
    });

    await expect(
      listRequests({ companyId: "cty-01", employeeId: "nv-99z" }),
    ).rejects.toThrow(/quyền/);
  });
});

describe("GET /api/requests — sap xep hai cot, khong chi mot cot (khang dinh tinh, T-02-09-06)", () => {
  it("5. route.ts sap xep theo ca 'created_at' LAN mot cot tiebreaker ('id')", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "app", "api", "requests", "route.ts"),
      "utf8",
    );

    const orderCalls = source.match(/\.order\(/g) ?? [];
    // Neu chi con MOT loi goi .order(...), tiebreaker da bi go bo -- thu tu
    // se khong on dinh khi hai yeu cau co cung created_at (seed tao cung luc).
    expect(orderCalls.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain('.order("created_at"');
    expect(source).toContain('.order("id"');
  });
});
