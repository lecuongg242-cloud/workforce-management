import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

/**
 * Nut "Hủy" cua `EmployeeForm` phai lam HAI viec khac nhau o hai ngu canh, va
 * chinh su nham lan giua chung la loi ma bai kiem nay khoa lai: bieu mau nam
 * trong hop thoai "Chỉnh sửa nhân viên" tung dieu huong nguoi dung ra khoi
 * trang ho so ho dang xem, thay vi chi dong hop thoai.
 *
 * Chi mock DUNG bon ranh gioi ngoai component (dieu huong, kho du lieu, hai
 * duong ghi) — ban than bieu mau, react-hook-form va cac nut chay THAT, vi
 * dieu can kiem la nhanh re cua chinh no.
 */

const push = vi.fn();
const back = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/data/store", () => ({
  useDataStore: () => ({ invalidate: vi.fn(), version: 0 }),
}));

vi.mock("@/lib/data/employees", () => ({
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
}));

vi.mock("@/lib/data/pay-rates", () => ({
  createPayRate: vi.fn(),
}));

import { EmployeeForm } from "@/components/employees/employee-form";
import type { Department, Employee, Shift } from "@/lib/types/domain";

const SHIFT: Shift = {
  id: "sft-01",
  companyId: "cty-01",
  name: "Ca hành chính",
  code: "HC",
  kind: "fixed",
  startTime: "08:00",
  endTime: "17:30",
  durationMinutes: null,
  breakMinutes: 60,
  breakStartTime: null,
  breakEndTime: null,
  lateToleranceMinutes: 5,
  workingDays: [1, 2, 3, 4, 5],
  overnight: false,
  status: "active",
};

const DEPARTMENT: Department = {
  id: "dept-01",
  companyId: "cty-01",
  name: "Sản xuất",
  description: "",
  managerId: null,
  status: "active",
};

const EMPLOYEE: Employee = {
  id: "nv-01",
  companyId: "cty-01",
  code: "NV023",
  fullName: "lecuong",
  email: "lecuong@timeflow.test",
  phone: null,
  dateOfBirth: null,
  gender: null,
  avatarUrl: null,
  departmentId: "dept-01",
  position: null,
  contractType: "full_time",
  startDate: "2026-01-01",
  managerId: null,
  shiftId: "sft-01",
  workLocation: "Văn phòng chính",
  status: "active",
  systemRole: "employee",
  invitationSent: false,
  canViewPayslip: false,
  canCheckInRemotely: false,
};

function renderForm(onCancel?: () => void): void {
  render(
    <EmployeeForm
      mode="edit"
      companyId="cty-01"
      employee={EMPLOYEE}
      departments={[DEPARTMENT]}
      shifts={[SHIFT]}
      allEmployees={[EMPLOYEE]}
      defaultStartDate="2026-08-10"
      onSaved={vi.fn()}
      onCancel={onCancel}
    />,
  );
}

/**
 * jsdom khong co `ResizeObserver`, ma cac primitive cua Radix (Switch, Select)
 * doc kich thuoc qua no ngay khi gan vao DOM. Stub toi thieu — bai kiem nay
 * khong khang dinh gi ve kich thuoc.
 */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  push.mockReset();
  back.mockReset();
});

describe("EmployeeForm — nut Hủy", () => {
  it("1. trong hop thoai (co onCancel): chi dong hop thoai, KHONG dieu huong", () => {
    const onCancel = vi.fn();
    renderForm(onCancel);

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    // Chinh day la loi da xay ra: hop thoai dong nhung nguoi dung bi nem ra
    // khoi trang ho so ho dang xem.
    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it("2. o trang rieng (khong onCancel): van dieu huong nhu cu", () => {
    renderForm(undefined);

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));

    expect(push).toHaveBeenCalledWith("/admin/employees");
  });

  it("3. dang co thay doi chua luu -> hoi truoc, chua dong/dieu huong gi ca", () => {
    const onCancel = vi.fn();
    renderForm(onCancel);

    fireEvent.change(screen.getByLabelText(/Họ và tên/), {
      target: { value: "Tên khác" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));

    // Chu cua hop thoai xac nhan phai noi DUNG viec sap xay ra — trong ngu
    // canh hop thoai, khong ai roi trang nao ca.
    expect(screen.getByText("Đóng khi chưa lưu?")).not.toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("4. xac nhan bo thay doi trong hop thoai -> dong hop thoai, KHONG dieu huong", () => {
    const onCancel = vi.fn();
    renderForm(onCancel);

    fireEvent.change(screen.getByLabelText(/Họ và tên/), {
      target: { value: "Tên khác" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: "Đóng, không lưu" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});
