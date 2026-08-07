import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadMonthContext } from "@/lib/attendance/month-context";
import { loadPayrollContext } from "@/lib/payroll/payroll-context";
import { buildPayrollRows } from "@/lib/payroll/payroll-rows";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * `employeeId` cua `buildPayrollRows()` la mot BO LOC, khong phai mot cong
 * quyen — cong nam o Route Handler (`assertCanViewOwnPayslip`).
 *
 * Ba bai nay canh dieu kien SQL: bo loc phai duoc DAY XUONG truy van chu khong
 * loc trong JS. Keo ca doanh nghiep ve roi bo di tat ca tru mot dong la doc
 * thua du lieu luong cua nguoi khac vao bo nho cua mot yeu cau do chinh ho goi.
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/payroll/payroll-context", () => ({
  loadPayrollContext: vi.fn(),
}));
vi.mock("@/lib/attendance/month-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/attendance/month-context")>();
  return { ...actual, loadMonthContext: vi.fn() };
});

const MONTH_CONTEXT = {
  start: "2026-08-01",
  end: "2026-09-01",
  breaks: {},
  shiftRules: new Map(),
  rules: {
    holidayDates: new Set<string>(),
    nightStartTime: "22:00",
    nightEndTime: "06:00",
    versionsByKey: new Map(),
    workMode: "shift" as const,
    standardHoursPerDay: 8,
    standardDaysPerMonth: 26,
  },
};

/**
 * Mot chuoi truy van ghi lai moi `eq` da goi. `then` lam no thenable, dung
 * khuon PostgREST — `await query` tra thang ket qua.
 */
function chain(result: { data: unknown[]; error: null }) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lt", "order", "in"]) {
    self[method] = vi.fn(() => self);
  }
  self.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return self as { eq: ReturnType<typeof vi.fn> } & Record<string, unknown>;
}

/** Phan biet bang theo TEN BANG, khong theo thu tu goi. */
function mockClient() {
  const employeeChain = chain({ data: [], error: null });
  const attendanceChain = chain({ data: [], error: null });
  const periodChain = chain({ data: [], error: null });
  (periodChain as Record<string, unknown>).maybeSingle = vi.fn(() =>
    Promise.resolve({ data: null, error: null }),
  );

  const client = {
    from: vi.fn((table: string) => {
      if (table === "employees") return employeeChain;
      if (table === "attendance_records") return attendanceChain;
      return periodChain;
    }),
  };
  return { client, employeeChain, attendanceChain };
}

function useClient(client: ReturnType<typeof mockClient>["client"]): void {
  vi.mocked(createServerSupabase).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
  );
}

describe("buildPayrollRows — phạm vi một nhân viên", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadMonthContext).mockResolvedValue(
      MONTH_CONTEXT as unknown as Awaited<ReturnType<typeof loadMonthContext>>,
    );
    vi.mocked(loadPayrollContext).mockResolvedValue({
      payRateByEmployee: new Map(),
      overtimeRateByEmployee: new Map(),
      adjustments: [],
    } as unknown as Awaited<ReturnType<typeof loadPayrollContext>>);
  });

  it("1. có employeeId -> eq('id', employeeId) đẩy xuống truy vấn nhân viên", async () => {
    const { client, employeeChain } = mockClient();
    useClient(client);

    await buildPayrollRows({
      companyId: "cty-01",
      month: "2026-08",
      employeeId: "nv-1",
    });

    expect(employeeChain.eq).toHaveBeenCalledWith("id", "nv-1");
    // Dieu kien doanh nghiep KHONG bi thay the — hai dieu kien cung ton tai.
    expect(employeeChain.eq).toHaveBeenCalledWith("company_id", "cty-01");
  });

  it("2. có employeeId -> eq('employee_id') đẩy xuống truy vấn chấm công", async () => {
    const { client, attendanceChain } = mockClient();
    useClient(client);

    await buildPayrollRows({
      companyId: "cty-01",
      month: "2026-08",
      employeeId: "nv-1",
    });

    expect(attendanceChain.eq).toHaveBeenCalledWith("employee_id", "nv-1");
    expect(attendanceChain.eq).toHaveBeenCalledWith("company_id", "cty-01");
  });

  it("3. KHÔNG có employeeId -> không điều kiện nào theo người (màn hình quản trị)", async () => {
    const { client, employeeChain, attendanceChain } = mockClient();
    useClient(client);

    await buildPayrollRows({ companyId: "cty-01", month: "2026-08" });

    expect(employeeChain.eq).not.toHaveBeenCalledWith("id", expect.anything());
    expect(attendanceChain.eq).not.toHaveBeenCalledWith(
      "employee_id",
      expect.anything(),
    );
  });
});
