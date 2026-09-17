import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * O "So tien" cua hop thoai "Khai muc luong moi" tung tu choi MOI con so
 * thuc te, va trinh duyet la ben tu choi chu khong phai Zod — nen khong mot
 * thong bao tieng Viet nao cua du an hien ra.
 *
 * `step="1000"` di kem `min="1"` lam MOC GOC cua buoc nhay thanh 1, nen tap
 * hop hop le la 1, 1001, 2001, ... — mot muc luong tron nhu 10.000.000 cung
 * bi chan, va don gia gio 28.422 thi bi doi thanh "28001 hoac 29001".
 *
 * Bai kiem nay khoa RANG BUOC, khong khoa mot con so: quy tac nghiep vu duy
 * nhat cua `payRateInputSchema` la "lon hon 0", nen o nhap phai chap nhan moi
 * so duong — ke ca so le va so thap phan (don gia gio ra tu mot phep chia
 * hiem khi tron).
 */

vi.mock("@/lib/data/store", () => ({
  useDataStore: () => ({ invalidate: vi.fn(), version: 0 }),
}));

vi.mock("@/lib/data/pay-rates", () => ({
  createPayRate: vi.fn(),
  getPayRateHistory: vi.fn(() =>
    Promise.resolve({ employeeId: "emp-01", current: null, versions: [] }),
  ),
}));

import { PayRatePanel } from "@/components/employees/pay-rate-panel";

async function openDialogAndGetAmountInput(): Promise<HTMLInputElement> {
  render(<PayRatePanel employeeId="emp-01" today="2026-09-17" />);
  const trigger = await screen.findByRole("button", {
    name: "Khai mức lương mới",
  });
  trigger.click();
  return (await screen.findByLabelText(/Số tiền/)) as HTMLInputElement;
}

describe("o So tien cua hop thoai khai muc luong", () => {
  it("chap nhan mot don gia gio le nhu 28.422", async () => {
    const input = await openDialogAndGetAmountInput();
    input.value = "28422";
    expect(input.validity.stepMismatch).toBe(false);
  });

  it("chap nhan mot muc luong thang tron nhu 10.000.000", async () => {
    const input = await openDialogAndGetAmountInput();
    input.value = "10000000";
    expect(input.validity.stepMismatch).toBe(false);
  });

  it("chap nhan mot don gia gio thap phan nhu 28.421,05", async () => {
    const input = await openDialogAndGetAmountInput();
    input.value = "28421.05";
    expect(input.validity.stepMismatch).toBe(false);
  });

  it("van tu choi so khong duong — quy tac nghiep vu that", async () => {
    const input = await openDialogAndGetAmountInput();
    input.value = "0";
    expect(input.validity.rangeUnderflow).toBe(true);
  });
});
