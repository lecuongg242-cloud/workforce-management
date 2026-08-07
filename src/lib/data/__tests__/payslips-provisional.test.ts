import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/payslips/[month]/route";
import { ForbiddenError, getSessionContext } from "@/lib/auth/session-context";
import { buildPayrollRows } from "@/lib/payroll/payroll-rows";
import { assertCanViewOwnPayslip } from "@/lib/payroll/payslip-access";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * `GET /api/payslips/[month]` — HAI NHANH.
 *
 * Bai 1 la bai quan trong nhat: cong quyen phai dung TRUOC ca nhanh tam tinh.
 * Nhanh do la duong doc MOI duoc mo ra o plan nay, va mot cong chi canh nhanh
 * cu se de nguyen mot cua sau ma khong ai thay.
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/payroll/payroll-rows", () => ({ buildPayrollRows: vi.fn() }));
vi.mock("@/lib/payroll/payslip-access", () => ({
  assertCanViewOwnPayslip: vi.fn(),
}));
vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return { ...actual, getSessionContext: vi.fn() };
});

const SESSION = {
  userId: "user-1",
  email: "nv1@timeflow.test",
  companyId: "cty-01",
  role: "employee" as const,
  employeeId: "nv-1",
  isPlatformAdmin: false,
  mustChangePassword: false,
};

const DAY = {
  date: "2026-08-03",
  dayType: "weekday" as const,
  state: "counted" as const,
  creditedDays: 1,
  regularMinutes: 480,
  overtimeMinutes: 0,
  convertedOvertimeHours: 0,
  hourDeltaMinutes: 0,
  basePay: 500_000,
  overtimePay: 0,
  hourAdjustment: 0,
  dayTotal: 500_000,
  missing: [],
};

const LIVE_ROW = {
  employeeId: "nv-1",
  employeeCode: "NV001",
  employeeName: "Nguyễn Minh Anh",
  departmentName: "Kinh doanh",
  payUnit: "month" as const,
  payAmount: 13_000_000,
  workedDays: 1,
  totalMinutes: 480,
  leaveDays: 0,
  lateCount: 0,
  overtimeMinutes: 0,
  overtimeNightMinutes: 0,
  convertedOvertimeHours: 0,
  missingMultiplierKeys: [],
  creditedDays: 1,
  regularMinutes: 480,
  hourDeltaMinutes: 0,
  missingWorkModeInputs: [],
  basePay: 500_000,
  overtimePay: 0,
  hourAdjustment: 0,
  allowanceItems: [],
  deductionItems: [],
  allowanceTotal: 0,
  deductionTotal: 0,
  netPay: 500_000,
  missing: [],
  days: [DAY],
};

/** Ky CHUA chot: truy van `payroll_runs` tra `null`. */
function clientWithoutRun() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: null, error: null }),
  );
  return { from: vi.fn(() => chain) };
}

function useClient(client: unknown): void {
  vi.mocked(createServerSupabase).mockResolvedValue(
    client as Awaited<ReturnType<typeof createServerSupabase>>,
  );
}

function callGet() {
  return GET(new Request("http://localhost/api/payslips/2026-08"), {
    params: Promise.resolve({ month: "2026-08" }),
  });
}

function mockLiveRows(rows: unknown[]): void {
  vi.mocked(buildPayrollRows).mockResolvedValue({
    workMode: "shift",
    periodStatus: "open",
    rows,
  } as unknown as Awaited<ReturnType<typeof buildPayrollRows>>);
}

describe("GET /api/payslips/[month]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionContext).mockResolvedValue(SESSION);
    vi.mocked(assertCanViewOwnPayslip).mockResolvedValue(undefined);
  });

  it("1. can_view_payslip=false -> 403 ở CẢ nhánh tạm tính, và KHÔNG tính gì", async () => {
    vi.mocked(assertCanViewOwnPayslip).mockRejectedValue(new ForbiddenError());
    useClient(clientWithoutRun());
    mockLiveRows([LIVE_ROW]);

    const response = await callGet();

    expect(response.status).toBe(403);
    // Cong quyen dung TRUOC moi phep tinh — khong duoc tinh xong roi moi tu
    // choi, vi nhu vay du lieu luong da duoc doc len bo nho roi.
    expect(buildPayrollRows).not.toHaveBeenCalled();
  });

  it("2. kỳ chưa chốt -> status provisional, closedAt null, kèm mảng ngày", async () => {
    useClient(clientWithoutRun());
    mockLiveRows([LIVE_ROW]);

    const response = await callGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("provisional");
    expect(body.closedAt).toBeNull();
    expect(body.days).toHaveLength(1);
    expect(body.days[0].dayTotal).toBe(500_000);
    // Tong cac ngay bang DUNG luong goc cua ky.
    expect(body.basePay).toBe(500_000);
  });

  it("3. phạm vi employeeId LUÔN lấy từ phiên, không từ tham số đường dẫn", async () => {
    useClient(clientWithoutRun());
    mockLiveRows([LIVE_ROW]);

    await callGet();

    expect(buildPayrollRows).toHaveBeenCalledWith({
      companyId: "cty-01",
      month: "2026-08",
      employeeId: "nv-1",
    });
  });

  it("4. không có dòng nào trong kỳ -> null, KHÔNG dò được lịch sử doanh nghiệp", async () => {
    useClient(clientWithoutRun());
    mockLiveRows([]);

    const response = await callGet();

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it("5. tài khoản chưa gắn với nhân viên nào -> null, không chạm tới quyền", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({
      ...SESSION,
      employeeId: null,
    } as unknown as Awaited<ReturnType<typeof getSessionContext>>);
    useClient(clientWithoutRun());

    const response = await callGet();

    expect(await response.json()).toBeNull();
    expect(assertCanViewOwnPayslip).not.toHaveBeenCalled();
    expect(buildPayrollRows).not.toHaveBeenCalled();
  });

  it("6. tháng sai định dạng -> 400, chặn trước cả phiên", async () => {
    const response = await GET(
      new Request("http://localhost/api/payslips/2026-8"),
      { params: Promise.resolve({ month: "2026-8" }) },
    );

    expect(response.status).toBe(400);
    expect(buildPayrollRows).not.toHaveBeenCalled();
  });
});
