import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionContext } from "@/lib/auth/session-context";
import {
  bulkMoveDepartment,
  createEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
} from "@/lib/data/employees";
import { createServerSupabase } from "@/lib/supabase/server";
import type { EmployeeInput } from "@/lib/types/domain";

/**
 * Ba bien ma bo do canh neu cho DATA-05 (plan 02-07): trung khop (adjacency),
 * thu tu (ordering), ranh gioi doanh nghiep (empty/tenant boundary).
 *
 * `createEmployee`/`updateEmployee`/`bulkMoveDepartment` la Server Action
 * ("use server"), khong di qua `fetch` nhu duong doc — Nhom A/D mock
 * `@/lib/auth/session-context` (giu nguyen `requireRole`/`ForbiddenError`
 * that qua `importOriginal`, chi thay `getSessionContext`) va
 * `@/lib/supabase/server` (giong khuon `session-context.test.ts`), thay vi
 * `vi.stubGlobal("fetch", ...)`. `listEmployees`/`getEmployee` la duong doc
 * qua `fetchJson` nen Nhom B/C dung dung khuon `departments.test.ts`/
 * `shifts.test.ts` (stub `fetch`).
 */

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return {
    ...actual,
    getSessionContext: vi.fn(),
  };
});

vi.mock("@/lib/data/audit", () => ({
  logMutation: vi.fn().mockResolvedValue(undefined),
}));

type FakeClient = Awaited<ReturnType<typeof createServerSupabase>>;

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

beforeEach(() => {
  vi.mocked(createServerSupabase).mockReset();
  vi.mocked(getSessionContext).mockReset();
});

const SESSION_ADMIN = {
  userId: "user-admin",
  email: "admin@timeflow.test",
  companyId: "cty-01",
  role: "admin" as const,
  employeeId: null,
  isPlatformAdmin: false,
  mustChangePassword: false,
};

function rawEmployeeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "emp-mock-1",
    company_id: "cty-01",
    code: "NV999",
    full_name: "Nguyễn Văn Test",
    email: "test@timeflow.test",
    phone: "0900000000",
    date_of_birth: "1990-01-01",
    gender: "male",
    avatar_url: null,
    department_id: "dept-01",
    position: "Nhân viên",
    contract_type: "full_time",
    start_date: "2024-01-01",
    manager_id: null,
    shift_id: "sft-01",
    work_location: "office",
    status: "active",
    system_role: "employee",
    invitation_sent: false,
    can_view_payslip: false,
    can_check_in_remotely: false,
    ...overrides,
  };
}

function employeeInput(overrides: Partial<EmployeeInput> = {}): EmployeeInput {
  return {
    code: "NV999",
    fullName: "Nguyễn Văn Test",
    email: "test@timeflow.test",
    phone: "0900000000",
    dateOfBirth: "1990-01-01",
    gender: "male",
    avatarUrl: null,
    departmentId: "dept-01",
    position: "Nhân viên",
    contractType: "full_time",
    startDate: "2024-01-01",
    managerId: null,
    shiftId: "sft-01",
    workLocation: "office",
    status: "active",
    systemRole: "employee",
    invitationSent: false,
    canViewPayslip: false,
    canCheckInRemotely: false,
    ...overrides,
  };
}

function fakeSupabaseForCreate(options: {
  codeTaken: boolean;
  insertError?: { code?: string; message?: string } | null;
  insertData?: Record<string, unknown> | null;
}): FakeClient {
  const client = {
    rpc: vi.fn().mockResolvedValue({ data: options.codeTaken, error: null }),
    from: vi.fn().mockReturnValue({
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: options.insertError ? null : (options.insertData ?? rawEmployeeRow()),
            error: options.insertError ?? null,
          }),
        }),
      }),
    }),
  };
  return client as unknown as FakeClient;
}

function fakeSupabaseForUpdate(options: {
  beforeRow: Record<string, unknown> | null;
  afterRow?: Record<string, unknown> | null;
}): FakeClient {
  const client = {
    from: vi.fn().mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: options.beforeRow,
              error: options.beforeRow ? null : { message: "not found" },
            }),
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: options.afterRow ?? options.beforeRow,
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  };
  return client as unknown as FakeClient;
}

describe("createEmployee — bien trung khop ma nhan vien (edge DATA-05 adjacency)", () => {
  it("1. RPC bao ma trung (tf_employee_code_taken=true) -> nem Error co message chua dung ma bi trung", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_ADMIN);
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeSupabaseForCreate({ codeTaken: true }),
    );

    await expect(
      createEmployee("cty-01", employeeInput({ code: "NV030" })),
    ).rejects.toThrow("Mã nhân viên NV030 đã tồn tại.");
  });

  it("2. RPC khong bao trung nhung insert vi pham rang buoc unique (23505) -> nem CUNG thong diep tieng Viet, khong de loi Postgres tho lot len", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_ADMIN);
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeSupabaseForCreate({
        codeTaken: false,
        insertError: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "employees_company_id_code_key"',
        },
      }),
    );

    await expect(
      createEmployee("cty-01", employeeInput({ code: "NV030" })),
    ).rejects.toThrow("Mã nhân viên NV030 đã tồn tại.");
  });

  it("3. Cung ma o mot 'doanh nghiep khac' (server tra RPC=false va insert thanh cong) -> tao thanh cong, ham khong tu chan dua tren trang thai phia client", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_ADMIN);
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeSupabaseForCreate({
        codeTaken: false,
        insertData: rawEmployeeRow({ id: "emp-new", code: "NV030" }),
      }),
    );

    const result = await createEmployee(
      "cty-01",
      employeeInput({ code: "NV030" }),
    );

    expect(result.id).toBe("emp-new");
    expect(result.code).toBe("NV030");
  });
});

const employeeA1 = {
  id: "emp-b1",
  companyId: "cty-01",
  code: "NV010",
  fullName: "Nguyễn Văn An",
  email: "a1@timeflow.test",
  phone: "0900000001",
  dateOfBirth: "1990-01-01",
  gender: "male" as const,
  avatarUrl: null,
  departmentId: "dept-01",
  position: "Nhân viên",
  contractType: "full_time" as const,
  startDate: "2024-01-01",
  managerId: null,
  shiftId: "sft-01",
  workLocation: "office",
  status: "active" as const,
  systemRole: "employee" as const,
  invitationSent: false,
  canViewPayslip: false,
  canCheckInRemotely: false,
  hasAccount: false,
};

// Trung ho ten voi employeeA1 -- id la tiebreaker on dinh (emp-b1 < emp-b2).
const employeeA2 = {
  ...employeeA1,
  id: "emp-b2",
  code: "NV011",
  email: "a2@timeflow.test",
};

describe("listEmployees — bien thu tu phan trang khi hai nhan vien trung ten (edge DATA-05 ordering)", () => {
  it("4. Thu tu trong items khop dung thu tu server tra, khong sap xep lai o client", async () => {
    stubFetchOnce({
      ok: true,
      json: async () => ({
        items: [employeeA1, employeeA2],
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      }),
    });

    const result = await listEmployees({ companyId: "cty-01" });

    expect(result.items.map((employee) => employee.id)).toEqual([
      "emp-b1",
      "emp-b2",
    ]);
  });

  it("5. Goi lai lien tiep tren cung du lieu -> tra ve cung mot thu tu ca hai lan", async () => {
    const response = {
      items: [employeeA1, employeeA2],
      total: 2,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };

    stubFetchOnce({ ok: true, json: async () => response });
    const first = await listEmployees({ companyId: "cty-01" });

    stubFetchOnce({ ok: true, json: async () => response });
    const second = await listEmployees({ companyId: "cty-01" });

    expect(first.items.map((employee) => employee.id)).toEqual(
      second.items.map((employee) => employee.id),
    );
  });

  it("6. Hop cua trang 1 va trang 2 co so phan tu bang total, khong id nao lap hay thieu", async () => {
    stubFetchOnce({
      ok: true,
      json: async () => ({
        items: [employeeA1],
        total: 2,
        page: 1,
        pageSize: 1,
        totalPages: 2,
      }),
    });
    const page1 = await listEmployees({ companyId: "cty-01", page: 1, pageSize: 1 });

    stubFetchOnce({
      ok: true,
      json: async () => ({
        items: [employeeA2],
        total: 2,
        page: 2,
        pageSize: 1,
        totalPages: 2,
      }),
    });
    const page2 = await listEmployees({ companyId: "cty-01", page: 2, pageSize: 1 });

    const combinedIds = [...page1.items, ...page2.items].map((employee) => employee.id);
    const uniqueIds = new Set(combinedIds);

    expect(combinedIds.length).toBe(page1.total);
    expect(uniqueIds.size).toBe(combinedIds.length);
  });

  it("7. Khang dinh tinh: src/app/api/employees/route.ts sap xep theo CA HAI cot full_name va id, khong chi theo ten", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "app", "api", "employees", "route.ts"),
      "utf8",
    );

    expect(source).toMatch(/\.order\(\s*"full_name"/);
    expect(source).toMatch(/\.order\(\s*"id"/);
  });
});

describe("ranh gioi doanh nghiep — getEmployee/bulkMoveDepartment (DATA-05)", () => {
  it("8. getEmployee: server tra than null -> ham tra null, KHONG nem", async () => {
    stubFetchOnce({ ok: true, json: async () => null });

    const result = await getEmployee("emp-x");

    expect(result).toBeNull();
  });

  it("9. bulkMoveDepartment voi mang ids rong -> tra 0 va KHONG thuc hien loi goi mang nao", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await bulkMoveDepartment([], "dept-01");

    expect(result).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSessionContext).not.toHaveBeenCalled();
  });
});

describe("updateEmployee — quyen sua ho so cua chinh minh (AUTH-03, T-02-07-02)", () => {
  it("vai tro employee sua duoc ho so CUA CHINH MINH (id bang employeeId cua phien)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({
      ...SESSION_ADMIN,
      role: "employee",
      employeeId: "emp-self",
    });
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeSupabaseForUpdate({
        beforeRow: rawEmployeeRow({ id: "emp-self" }),
        afterRow: rawEmployeeRow({ id: "emp-self", position: "Vị trí mới" }),
      }),
    );

    const result = await updateEmployee("emp-self", { position: "Vị trí mới" });

    expect(result.id).toBe("emp-self");
    expect(result.position).toBe("Vị trí mới");
  });

  it("vai tro employee KHONG sua duoc ho so cua NGUOI KHAC -> nem loi quyen truoc khi cham DB", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({
      ...SESSION_ADMIN,
      role: "employee",
      employeeId: "emp-self",
    });

    await expect(
      updateEmployee("emp-nguoi-khac", { position: "Vị trí mới" }),
    ).rejects.toThrow("Bạn không có quyền thực hiện thao tác này.");
    expect(createServerSupabase).not.toHaveBeenCalled();
  });
});
