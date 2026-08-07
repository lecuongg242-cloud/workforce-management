// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as GET_ATTENDANCE } from "@/app/api/attendance/route";
import { GET as GET_REQUESTS } from "@/app/api/requests/route";
import { getSessionContext } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * HOI QUY: pham vi MAC DINH, khong phai pham vi TUY CHON (AUTH-03).
 *
 * ======================================================================
 * LO HONG NAY DA TUNG TON TAI THAT
 * ======================================================================
 *
 * `GET /api/attendance` nhan `employeeId` la tham so KHONG BAT BUOC, va phep
 * kiem quyen cu chi chay khi tham so CO MAT:
 *
 *     if (!isAdminRole && queryParams.employeeId && queryParams.employeeId !== sessionEmployeeId)
 *       throw new ForbiddenError();
 *     ...
 *     if (queryParams.employeeId) query = query.eq("employee_id", ...);
 *
 * Mot nhan vien goi `?month=2026-07` — BO TRONG tham so — thi khong nhanh nao
 * chay: khong bi tu choi, va cung khong bi loc. RLS `tf_is_member` cho qua vi
 * ho dung la thanh vien cua doanh nghiep. Ket qua: doc duoc cham cong CUA CA
 * DOANH NGHIEP.
 *
 * ======================================================================
 * VI SAO TEST DOC `.eq()` CHU KHONG DOC PHAN HOI
 * ======================================================================
 *
 * Mot phan hoi rong khong chung minh dieu gi — no co the rong vi du lieu rong.
 * Thu duy nhat phan biet duoc "da loc" voi "khong loc" la chinh dieu kien da
 * gui xuong database. Vi vay client gia ghi lai moi `.eq()`, va test khang
 * dinh su CO MAT cua `employee_id` — mot khang dinh khong nguy trang duoc.
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return { ...actual, getSessionContext: vi.fn() };
});

type FakeClient = Awaited<ReturnType<typeof createServerSupabase>>;

const COMPANY_ID = "cty-01";
const SELF_EMPLOYEE_ID = "nv-01a";
const OTHER_EMPLOYEE_ID = "nv-02";

function session(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    email: "nv001@ngocphat.test",
    companyId: COMPANY_ID,
    role: "employee" as const,
    employeeId: SELF_EMPLOYEE_ID,
    isPlatformAdmin: false,
    mustChangePassword: false,
    ...overrides,
  };
}

function fakeClient(): { client: FakeClient; eqCalls: Array<[string, unknown]> } {
  const eqCalls: Array<[string, unknown]> = [];

  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;

    builder.select = chain;
    builder.order = chain;
    builder.gte = chain;
    builder.lt = chain;
    builder.in = chain;
    builder.eq = (column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    };
    builder.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: [], error: null });

    return builder;
  });

  return { client: { from } as unknown as FakeClient, eqCalls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.mocked(createServerSupabase).mockReset();
  vi.mocked(getSessionContext).mockReset();
});

describe("GET /api/attendance — pham vi mac dinh theo phien (AUTH-03)", () => {
  it("BO TRONG employeeId: van loc ve chinh minh, khong tra ca doanh nghiep", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());
    const { client, eqCalls } = fakeClient();
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET_ATTENDANCE(
      new Request("http://localhost/api/attendance?month=2026-07"),
    );

    expect(response.status).toBe(200);
    // Day la dong quan trong nhat cua ca file.
    expect(eqCalls).toContainEqual(["employee_id", SELF_EMPLOYEE_ID]);
  });

  it("hoi nguoi khac van bi tu choi 403", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());
    const { client } = fakeClient();
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET_ATTENDANCE(
      new Request(
        `http://localhost/api/attendance?employeeId=${OTHER_EMPLOYEE_ID}`,
      ),
    );

    expect(response.status).toBe(403);
  });

  it("quan tri BO TRONG employeeId thi van doc duoc ca doanh nghiep", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(
      session({ role: "admin", employeeId: null }),
    );
    const { client, eqCalls } = fakeClient();
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET_ATTENDANCE(
      new Request("http://localhost/api/attendance?month=2026-07"),
    );

    expect(response.status).toBe(200);
    // Khong duoc siet nham chieu nguoc lai: bang cong cua quan tri phai con
    // nhin thay moi nguoi.
    expect(eqCalls.some(([column]) => column === "employee_id")).toBe(false);
    expect(eqCalls).toContainEqual(["company_id", COMPANY_ID]);
  });

  it("phien khong gan ho so nhan vien: tra rong, KHONG roi vao nhanh khong loc", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session({ employeeId: null }));
    // Khong mock database: cham toi no o nhanh nay la mot that bai.
    const response = await GET_ATTENDANCE(
      new Request("http://localhost/api/attendance?month=2026-07"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(vi.mocked(createServerSupabase)).not.toHaveBeenCalled();
  });
});

describe("GET /api/requests — cung mot lop lo hong (AUTH-03)", () => {
  it("phien khong gan ho so nhan vien: tra rong thay vi ca doanh nghiep", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session({ employeeId: null }));

    const response = await GET_REQUESTS(
      new Request("http://localhost/api/requests"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(vi.mocked(createServerSupabase)).not.toHaveBeenCalled();
  });

  it("BO TRONG employeeId: van loc ve chinh minh", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());
    const { client, eqCalls } = fakeClient();
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET_REQUESTS(
      new Request("http://localhost/api/requests"),
    );

    expect(response.status).toBe(200);
    expect(eqCalls).toContainEqual(["employee_id", SELF_EMPLOYEE_ID]);
  });
});
