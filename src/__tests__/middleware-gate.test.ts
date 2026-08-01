import { describe, expect, it } from "vitest";

import { resolveGate } from "@/middleware";

/**
 * Test ham thuan `resolveGate` — logic quyet dinh "duong dan nay di dau" da
 * duoc tach khoi runtime Next (xem src/middleware.ts) chinh vi Vitest khong
 * chay duoc Server Component/middleware that.
 */
describe("resolveGate (AUTH-02)", () => {
  it("/admin/dashboard + khong claims -> redirect /login", () => {
    expect(
      resolveGate({ pathname: "/admin/dashboard", hasClaims: false }),
    ).toEqual({ action: "redirect", to: "/login" });
  });

  it("/employee + khong claims -> redirect /login", () => {
    expect(resolveGate({ pathname: "/employee", hasClaims: false })).toEqual({
      action: "redirect",
      to: "/login",
    });
  });

  it("/employee/history + khong claims -> redirect /login (duong dan con cung bi chan)", () => {
    expect(
      resolveGate({ pathname: "/employee/history", hasClaims: false }),
    ).toEqual({ action: "redirect", to: "/login" });
  });

  it("/login + khong claims -> pass", () => {
    expect(resolveGate({ pathname: "/login", hasClaims: false })).toEqual({
      action: "pass",
    });
  });

  it("/login + co claims -> redirect /admin/dashboard", () => {
    expect(resolveGate({ pathname: "/login", hasClaims: true })).toEqual({
      action: "redirect",
      to: "/admin/dashboard",
    });
  });

  it("/admin/dashboard + co claims -> pass", () => {
    expect(
      resolveGate({ pathname: "/admin/dashboard", hasClaims: true }),
    ).toEqual({ action: "pass" });
  });

  it("/select-company + co claims -> pass", () => {
    expect(resolveGate({ pathname: "/select-company", hasClaims: true })).toEqual({
      action: "pass",
    });
  });

  it("/administration + khong claims -> pass (so khop theo doan duong dan, khong phai tien to chuoi tho)", () => {
    expect(
      resolveGate({ pathname: "/administration", hasClaims: false }),
    ).toEqual({ action: "pass" });
  });
});
