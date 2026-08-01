import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getServerMonth, getServerToday } from "@/lib/today";

/**
 * `getServerToday()`/`getServerMonth()` la nguon DUY NHAT cua "hom nay"
 * (D-19). Ba nhom kiem chung:
 * 1. Hinh dang chuoi tra ve dung "YYYY-MM-DD"/"YYYY-MM".
 * 2. KHONG phu thuoc `process.env.TZ` cua tien trinh Node — `Intl.DateTimeFormat`
 *    o day luon nhan `timeZone` tuong minh (Asia/Ho_Chi_Minh), nen doi
 *    `process.env.TZ` giua "UTC" va "America/New_York" khong duoc lam ket
 *    qua khac nhau.
 * 3. Bien canh D-08/D-19: mot khoanh khac thuoc "hom sau" theo gio Viet Nam
 *    nhung van la "hom nay" theo gio UTC (buoi toi muon theo UTC) phai cho
 *    ra ngay VIET NAM, khong phai ngay UTC.
 */

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
  vi.useRealTimers();
});

describe("getServerToday/getServerMonth — hinh dang chuoi", () => {
  it("getServerToday tra ve dung dinh dang YYYY-MM-DD", async () => {
    const today = await getServerToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("getServerMonth tra ve dung 7 ky tu dau cua getServerToday", async () => {
    const today = await getServerToday();
    const month = await getServerMonth();
    expect(month).toBe(today.slice(0, 7));
    expect(month).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("getServerToday — khong phu thuoc process.env.TZ cua tien trinh Node", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Co dinh mot khoanh khac cu the de so sanh giua hai bien TZ khac nhau.
    vi.setSystemTime(new Date("2026-08-01T10:00:00.000Z"));
  });

  it("TZ=UTC va TZ=America/New_York cho CUNG mot ket qua", async () => {
    process.env.TZ = "UTC";
    const resultUtc = await getServerToday();

    process.env.TZ = "America/New_York";
    const resultNewYork = await getServerToday();

    expect(resultUtc).toBe(resultNewYork);
    expect(resultUtc).toBe("2026-08-01");
  });
});

describe("getServerToday — bien canh D-19: khoanh khac da sang 'hom sau' theo gio VN nhung con 'hom nay' theo UTC", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("20:00 UTC ngay 31/07 la 03:00 sang gio VN ngay 01/08 -> phai tra ve ngay VIET NAM (01/08), khong phai ngay UTC (31/07)", async () => {
    // 2026-07-31T20:00:00Z + 7h = 2026-08-01T03:00 gio Viet Nam.
    vi.setSystemTime(new Date("2026-07-31T20:00:00.000Z"));

    const today = await getServerToday();

    expect(today).toBe("2026-08-01");
  });
});
