import { describe, expect, it } from "vitest";

import {
  describeScopes,
  isTargeted,
  resolveTargets,
  type ScopeEmployee,
} from "@/lib/payroll/scope";
import type { PayAdjustmentScope } from "@/lib/types/domain";

/**
 * Phep giai pham vi (D-40) o tang mo-dun thuan.
 *
 * Bai QUAN TRONG NHAT file nay la bai "them mot nguoi moi vao doanh nghiep":
 * voi cach khai include/exclude, ho TU DONG vao pham vi toan cong ty; voi cach
 * khai "liet ke tay 38 nguoi", ho khong — va khong co gi bao dong, vi he thong
 * khong biet dang ra ho phai co.
 */

function scope(
  overrides: Partial<PayAdjustmentScope> & Pick<PayAdjustmentScope, "mode" | "scopeType">,
): PayAdjustmentScope {
  return {
    id: `${overrides.mode}-${overrides.scopeType}-${overrides.scopeValue ?? "all"}`,
    companyId: "cty-01",
    adjustmentId: "adj-01",
    scopeValue: null,
    ...overrides,
  };
}

const INCLUDE_COMPANY = scope({ mode: "include", scopeType: "company" });

/** 40 nhan vien: 20 phong A, 20 phong B; mot nua moi phong la "Nhân viên kho". */
function makeCompany(size: number): ScopeEmployee[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `nv-${index + 1}`,
    departmentId: index < size / 2 ? "dept-a" : "dept-b",
    position: index % 2 === 0 ? "Nhân viên kho" : "Nhân viên văn phòng",
  }));
}

const COMPANY_40 = makeCompany(40);

describe("Không khai phạm vi thì không ai bị áp — im lặng KHÔNG phải 'tất cả'", () => {
  it("1. không dòng `include` nào -> không ai bị áp", () => {
    expect(resolveTargets({ employees: COMPANY_40, scopes: [] })).toEqual([]);
  });

  it("2. chỉ có dòng `exclude` -> vẫn không ai bị áp (exclude không tự sinh ra include)", () => {
    const scopes = [
      scope({ mode: "exclude", scopeType: "employee", scopeValue: "nv-1" }),
    ];

    expect(resolveTargets({ employees: COMPANY_40, scopes })).toEqual([]);
  });
});

describe("'Toàn công ty trừ mấy người' — hai chiều, không phải một danh sách", () => {
  it("3. toàn công ty trừ 2 người -> 38/40", () => {
    const scopes = [
      INCLUDE_COMPANY,
      scope({ mode: "exclude", scopeType: "employee", scopeValue: "nv-1" }),
      scope({ mode: "exclude", scopeType: "employee", scopeValue: "nv-2" }),
    ];

    const targets = resolveTargets({ employees: COMPANY_40, scopes });

    expect(targets.length).toBe(38);
    expect(targets.map((employee) => employee.id)).not.toContain("nv-1");
    expect(targets.map((employee) => employee.id)).not.toContain("nv-2");
  });

  it("4. THÊM MỘT NGƯỜI MỚI -> 39/41 mà KHÔNG phải sửa cấu hình (lý do không liệt kê tay)", () => {
    const scopes = [
      INCLUDE_COMPANY,
      scope({ mode: "exclude", scopeType: "employee", scopeValue: "nv-1" }),
      scope({ mode: "exclude", scopeType: "employee", scopeValue: "nv-2" }),
    ];

    const grown: ScopeEmployee[] = [
      ...COMPANY_40,
      { id: "nv-41", departmentId: "dept-b", position: "Nhân viên kho" },
    ];
    const targets = resolveTargets({ employees: grown, scopes });

    // 41 - 2 = 39. Neu pham vi duoc khai bang cach liet ke 38 nguoi, con so
    // nay van la 38 — va nguoi thu 41 mat phu cap dang co MA KHONG AI BIET.
    expect(targets.length).toBe(39);
    expect(targets.map((employee) => employee.id)).toContain("nv-41");
  });
});

describe("`exclude` LUÔN thắng `include`, theo cả hai chiều rộng/hẹp", () => {
  it("5. `exclude` CỤ THỂ (một người) thắng `include` RỘNG (cả công ty)", () => {
    const scopes = [
      INCLUDE_COMPANY,
      scope({ mode: "exclude", scopeType: "employee", scopeValue: "nv-3" }),
    ];

    expect(
      isTargeted({ employee: COMPANY_40[2], scopes }),
    ).toBe(false);
  });

  it("6. `exclude` RỘNG (cả phòng ban) thắng `include` CỤ THỂ (đúng người đó)", () => {
    const scopes = [
      scope({ mode: "include", scopeType: "employee", scopeValue: "nv-3" }),
      scope({ mode: "exclude", scopeType: "department", scopeValue: "dept-a" }),
    ];

    // Quy tac DOAN DUOC ("bi loai tru thi khong duoc, het") quan trong hon quy
    // tac thong minh: nguoi khai khong phai giu mot bang uu tien trong dau.
    expect(isTargeted({ employee: COMPANY_40[2], scopes })).toBe(false);
  });

  it("7. thứ tự các dòng KHÔNG làm đổi kết quả", () => {
    const employee = COMPANY_40[2];
    const forward = [
      INCLUDE_COMPANY,
      scope({ mode: "exclude", scopeType: "employee", scopeValue: "nv-3" }),
    ];
    const reversed = [...forward].reverse();

    expect(isTargeted({ employee, scopes: forward })).toBe(
      isTargeted({ employee, scopes: reversed }),
    );
    expect(isTargeted({ employee, scopes: reversed })).toBe(false);
  });
});

describe("Phạm vi theo phòng ban, chức vụ và cá nhân", () => {
  it("8. phòng ban -> đúng 20 người của phòng đó", () => {
    const scopes = [
      scope({ mode: "include", scopeType: "department", scopeValue: "dept-a" }),
    ];

    const targets = resolveTargets({ employees: COMPANY_40, scopes });

    expect(targets.length).toBe(20);
    expect(targets.every((employee) => employee.departmentId === "dept-a")).toBe(true);
  });

  it("9. chức vụ -> so khớp CHUỖI CHÍNH XÁC sau khi cắt khoảng trắng", () => {
    const exact = [
      scope({ mode: "include", scopeType: "position", scopeValue: "Nhân viên kho" }),
    ];
    const padded = [
      scope({ mode: "include", scopeType: "position", scopeValue: "  Nhân viên kho  " }),
    ];

    expect(resolveTargets({ employees: COMPANY_40, scopes: exact }).length).toBe(20);
    // Khoang trang thua duoc cat — mot lan copy-paste khong lam mat 20 nguoi.
    expect(resolveTargets({ employees: COMPANY_40, scopes: padded }).length).toBe(20);
  });

  it("10. gõ SAI chính tả chức vụ -> 0 người bị áp, KHÔNG phải một lỗi (giới hạn đã biết)", () => {
    const scopes = [
      scope({ mode: "include", scopeType: "position", scopeValue: "Nhân viên Kho" }),
    ];

    // Chu "K" hoa. Day la gioi han that cua viec `position` la text tu do —
    // va la ly do man hinh khai BAT BUOC hien truoc danh sach nguoi bi ap.
    expect(resolveTargets({ employees: COMPANY_40, scopes }).length).toBe(0);
  });

  it("11. nhân viên chưa có phòng ban KHÔNG khớp phạm vi phòng ban nào", () => {
    const orphan: ScopeEmployee = {
      id: "nv-orphan",
      departmentId: null,
      position: "Nhân viên kho",
    };
    const scopes = [
      scope({ mode: "include", scopeType: "department", scopeValue: "dept-a" }),
    ];

    expect(isTargeted({ employee: orphan, scopes })).toBe(false);
  });

  it("12. nhiều dòng `include` cộng dồn — phòng A HOẶC chức vụ kho", () => {
    const scopes = [
      scope({ mode: "include", scopeType: "department", scopeValue: "dept-a" }),
      scope({ mode: "include", scopeType: "position", scopeValue: "Nhân viên kho" }),
    ];

    // 20 nguoi phong A + 10 nguoi kho cua phong B = 30.
    expect(resolveTargets({ employees: COMPANY_40, scopes }).length).toBe(30);
  });
});

describe("describeScopes — câu tóm tắt hiện trong bảng", () => {
  const labels = {
    company: "Toàn công ty",
    department: (value: string) => `Phòng ${value}`,
    position: (value: string) => `Chức vụ ${value}`,
    employee: (value: string) => `Nhân viên ${value}`,
    excludeSuffix: (count: number) => `trừ ${count} người`,
    none: "Chưa khai phạm vi",
  };

  it("13. 'Toàn công ty, trừ 2 người'", () => {
    const scopes = [
      INCLUDE_COMPANY,
      scope({ mode: "exclude", scopeType: "employee", scopeValue: "nv-1" }),
      scope({ mode: "exclude", scopeType: "employee", scopeValue: "nv-2" }),
    ];

    expect(describeScopes({ scopes, labels })).toBe("Toàn công ty, trừ 2 người");
  });

  it("14. chưa khai phạm vi -> nói thẳng là chưa khai, không nói 'Toàn công ty'", () => {
    expect(describeScopes({ scopes: [], labels })).toBe("Chưa khai phạm vi");
  });
});
