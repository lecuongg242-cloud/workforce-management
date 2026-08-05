import { describe, expect, it } from "vitest";

import { resolveGate } from "@/middleware";

/**
 * Test ham thuan `resolveGate` — logic quyet dinh "duong dan nay di dau" da
 * duoc tach khoi runtime Next (xem src/middleware.ts) chinh vi Vitest khong
 * chay duoc Server Component/middleware that.
 *
 * `mustChangePassword: false` o moi test trong nhom nay (AUTH-02, tu plan
 * 02-04) — cac test nay kiem cong bao ve route CU, khong lien quan co buoc
 * doi mat khau; nhom test rieng cho co do (D-16, plan 02-10) o Task 3.
 */
describe("resolveGate (AUTH-02)", () => {
  it("/admin/dashboard + khong claims -> redirect /login", () => {
    expect(
      resolveGate({
        pathname: "/admin/dashboard",
        hasClaims: false,
        mustChangePassword: false,
      }),
    ).toEqual({ action: "redirect", to: "/login" });
  });

  it("/employee + khong claims -> redirect /login", () => {
    expect(
      resolveGate({ pathname: "/employee", hasClaims: false, mustChangePassword: false }),
    ).toEqual({
      action: "redirect",
      to: "/login",
    });
  });

  it("/employee/history + khong claims -> redirect /login (duong dan con cung bi chan)", () => {
    expect(
      resolveGate({
        pathname: "/employee/history",
        hasClaims: false,
        mustChangePassword: false,
      }),
    ).toEqual({ action: "redirect", to: "/login" });
  });

  it("/login + khong claims -> pass", () => {
    expect(
      resolveGate({ pathname: "/login", hasClaims: false, mustChangePassword: false }),
    ).toEqual({
      action: "pass",
    });
  });

  // Dich den la "/" chu KHONG phai "/admin/dashboard": middleware chi co JWT
  // nen khong biet vai tro, `src/app/page.tsx` moi re duoc theo vai tro.
  it("/login + co claims -> redirect / (de trang goc re theo vai tro)", () => {
    expect(
      resolveGate({ pathname: "/login", hasClaims: true, mustChangePassword: false }),
    ).toEqual({
      action: "redirect",
      to: "/",
    });
  });

  it("/admin/dashboard + co claims -> pass", () => {
    expect(
      resolveGate({
        pathname: "/admin/dashboard",
        hasClaims: true,
        mustChangePassword: false,
      }),
    ).toEqual({ action: "pass" });
  });

  it("/select-company + co claims -> pass", () => {
    expect(
      resolveGate({
        pathname: "/select-company",
        hasClaims: true,
        mustChangePassword: false,
      }),
    ).toEqual({
      action: "pass",
    });
  });

  it("/administration + khong claims -> pass (so khop theo doan duong dan, khong phai tien to chuoi tho)", () => {
    expect(
      resolveGate({
        pathname: "/administration",
        hasClaims: false,
        mustChangePassword: false,
      }),
    ).toEqual({ action: "pass" });
  });
});

/**
 * Nhom test co buoc doi mat khau (D-16, plan 02-10 Task 3). Sau khi tam bo
 * quy tac chan duong dan chon doanh nghiep khoi ham thuan (`resolveGate`),
 * test thu ba trong nhom nay PHAI do — day la "vong de bo sot nhat" ma
 * `/select-company` khong nam trong hai tien to `PROTECTED_PREFIXES`.
 */
describe("resolveGate — co buoc doi mat khau (D-16)", () => {
  it("1. co bat, duong dan khu vuc quan tri -> chuyen huong toi trang doi mat khau", () => {
    expect(
      resolveGate({
        pathname: "/admin/dashboard",
        hasClaims: true,
        mustChangePassword: true,
      }),
    ).toEqual({ action: "redirect", to: "/doi-mat-khau" });
  });

  it("2. co bat, duong dan khu vuc nhan vien -> chuyen huong toi trang doi mat khau", () => {
    expect(
      resolveGate({ pathname: "/employee", hasClaims: true, mustChangePassword: true }),
    ).toEqual({ action: "redirect", to: "/doi-mat-khau" });
  });

  it("3. co bat, duong dan chon doanh nghiep -> chuyen huong toi trang doi mat khau (loi vong de bo sot nhat, /select-company khong nam trong PROTECTED_PREFIXES)", () => {
    expect(
      resolveGate({
        pathname: "/select-company",
        hasClaims: true,
        mustChangePassword: true,
      }),
    ).toEqual({ action: "redirect", to: "/doi-mat-khau" });
  });

  it("4. co bat, duong dan trang doi mat khau -> cho qua", () => {
    expect(
      resolveGate({
        pathname: "/doi-mat-khau",
        hasClaims: true,
        mustChangePassword: true,
      }),
    ).toEqual({ action: "pass" });
  });

  it("5. co tat, co claims, duong dan trang doi mat khau -> chuyen huong ve trang goc (re theo vai tro)", () => {
    expect(
      resolveGate({
        pathname: "/doi-mat-khau",
        hasClaims: true,
        mustChangePassword: false,
      }),
    ).toEqual({ action: "redirect", to: "/" });
  });

  it("6. co tat, khong claims, duong dan trang doi mat khau -> chuyen huong ve dang nhap", () => {
    expect(
      resolveGate({
        pathname: "/doi-mat-khau",
        hasClaims: false,
        mustChangePassword: false,
      }),
    ).toEqual({ action: "redirect", to: "/login" });
  });
});
