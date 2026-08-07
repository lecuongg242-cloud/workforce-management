// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as GET_LIST } from "@/app/api/payslips/route";
import { GET as GET_DETAIL } from "@/app/api/payslips/[month]/route";
import { getSessionContext } from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * PAY-05 — phieu luong cua CHINH nguoi dang nhap.
 *
 * Bon khang dinh quan trong nhat, va vi sao tung cai:
 *
 *   (1) `employee_id` LUON duoc dua vao truy van. Day la khang dinh trung tam:
 *       lo hong da tung ton tai o `GET /api/attendance` la mot dieu kien loc
 *       CHI chay khi client chiu gui tham so. Test nay doc lai chinh chuoi
 *       `.eq()` da goi, chu khong doc ket qua — mot phan hoi rong co the den
 *       tu du lieu rong, nhung mot `.eq("employee_id", ...)` bi thieu thi
 *       khong the nguy trang.
 *
 *   (2) Khong tham so nao doi duoc pham vi. Route liet ke KHONG nhan tham so;
 *       route chi tiet nhan `month` chu khong nhan nguoi.
 *
 *   (3) `can_view_payslip = false` -> 403, gac o SERVER chu khong chi an nav.
 *
 *   (4) Ky chua chot -> `null`/rong, KHONG ro con so tinh luc truy van.
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

vi.mock("@/lib/auth/session-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/session-context")>();
  return { ...actual, getSessionContext: vi.fn() };
});

type FakeClient = Awaited<ReturnType<typeof createServerSupabase>>;

const COMPANY_ID = "cty-01";
const EMPLOYEE_ID = "nv-01a";

function session(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    email: "nv001@ngocphat.test",
    companyId: COMPANY_ID,
    role: "employee" as const,
    employeeId: EMPLOYEE_ID,
    isPlatformAdmin: false,
    mustChangePassword: false,
    ...overrides,
  };
}

/** Moi cap (bang, cot, gia tri) da di qua `.eq()` trong mot lan goi. */
type EqCall = [table: string, column: string, value: unknown];

/**
 * Client gia ghi lai MOI `.eq()` theo tung bang. Cac phuong thuc chuoi deu tra
 * ve chinh no, nen thu tu goi khong anh huong — test chi quan tam tap dieu
 * kien cuoi cung.
 */
function fakeClient(rows: Record<string, unknown>): {
  client: FakeClient;
  eqCalls: EqCall[];
} {
  const eqCalls: EqCall[] = [];

  const from = vi.fn((table: string) => {
    const result = rows[table] ?? null;
    const builder: Record<string, unknown> = {};
    const chain = () => builder;

    builder.select = chain;
    builder.order = chain;
    builder.eq = (column: string, value: unknown) => {
      eqCalls.push([table, column, value]);
      return builder;
    };
    builder.maybeSingle = () => Promise.resolve({ data: result, error: null });
    // Duong khong `maybeSingle()` (danh sach): `await` tren builder.
    builder.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: result, error: null });

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

/* -------------------------------------------------------------------------- */
/* (1)+(2) Pham vi theo phien — khang dinh trung tam                           */
/* -------------------------------------------------------------------------- */

describe("GET /api/payslips — pham vi den tu phien, khong tu tham so", () => {
  it("luon loc theo employee_id cua phien du khong tham so nao duoc gui", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());
    const { client, eqCalls } = fakeClient({
      employees: { can_view_payslip: true },
      payroll_lines: [],
    });
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET_LIST();
    expect(response.status).toBe(200);

    const lineFilters = eqCalls.filter(([table]) => table === "payroll_lines");
    expect(lineFilters).toContainEqual([
      "payroll_lines",
      "employee_id",
      EMPLOYEE_ID,
    ]);
    expect(lineFilters).toContainEqual([
      "payroll_lines",
      "company_id",
      COMPANY_ID,
    ]);
  });

  it("khong nhan tham so nao — chu ky GET la zero-arity", () => {
    // Mot route khong co cho de truyen `employeeId` vao thi khong co duong
    // nao de quen kiem tra no. Day la rang buoc thiet ke, khong phai hanh vi
    // luc chay — nen no duoc khang dinh o chu ky ham.
    expect(GET_LIST.length).toBe(0);
  });

  it("chi tiet mot ky cung loc theo employee_id cua phien", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());
    const { client, eqCalls } = fakeClient({
      employees: { can_view_payslip: true },
      payroll_runs: { id: "run-1", closed_at: "2026-08-01T03:00:00Z" },
      payroll_lines: null,
    });
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    await GET_DETAIL(new Request("http://localhost/api/payslips/2026-07"), {
      params: Promise.resolve({ month: "2026-07" }),
    });

    expect(eqCalls).toContainEqual([
      "payroll_lines",
      "employee_id",
      EMPLOYEE_ID,
    ]);
  });

  it("tra danh sach rong khi phien chua gan voi mot ho so nhan vien", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session({ employeeId: null }));
    // KHONG mock `createServerSupabase`: neu route cham database o nhanh nay
    // thi no se nem, va test do lai chinh dieu do.
    const response = await GET_LIST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* (3) Cong `can_view_payslip`                                                 */
/* -------------------------------------------------------------------------- */

describe("Cong can_view_payslip duoc gac o server (PAY-05)", () => {
  it("tu choi 403 khi co bi tat", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());
    const { client } = fakeClient({
      employees: { can_view_payslip: false },
      payroll_lines: [],
    });
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET_LIST();
    expect(response.status).toBe(403);
  });

  it("tu choi 403 o ca duong chi tiet, khong chi o danh sach", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());
    const { client } = fakeClient({
      employees: { can_view_payslip: false },
      payroll_runs: { id: "run-1", closed_at: "2026-08-01T03:00:00Z" },
    });
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET_DETAIL(
      new Request("http://localhost/api/payslips/2026-07"),
      { params: Promise.resolve({ month: "2026-07" }) },
    );
    expect(response.status).toBe(403);
  });

  it("tu choi 403 khi ho so thuoc doanh nghiep khac (maybeSingle tra null)", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());
    const { client } = fakeClient({ employees: null, payroll_lines: [] });
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET_LIST();
    expect(response.status).toBe(403);
  });
});

/* -------------------------------------------------------------------------- */
/* (4) Chi doc ban chot — ky chua chot khong ro con so nao                      */
/* -------------------------------------------------------------------------- */

describe("Chi doc ban chot, khong tinh luc truy van (D-46)", () => {
  it("tra null khi ky chua duoc chot luong", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());
    const { client } = fakeClient({
      employees: { can_view_payslip: true },
      payroll_runs: null,
    });
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET_DETAIL(
      new Request("http://localhost/api/payslips/2026-07"),
      { params: Promise.resolve({ month: "2026-07" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it("tra null khi ky da chot nhung nguoi nay khong co dong nao", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());
    const { client } = fakeClient({
      employees: { can_view_payslip: true },
      payroll_runs: { id: "run-1", closed_at: "2026-08-01T03:00:00Z" },
      payroll_lines: null,
    });
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const response = await GET_DETAIL(
      new Request("http://localhost/api/payslips/2026-07"),
      { params: Promise.resolve({ month: "2026-07" }) },
    );

    expect(response.status).toBe(200);
    // CUNG mot cau tra loi voi "ky chua chot" — hai truong hop khong duoc
    // phan biet duoc voi nhau, neu khong thi lich su chot luong cua doanh
    // nghiep do duoc bang cach thu tung thang.
    expect(await response.json()).toBeNull();
  });

  it("tu choi 400 voi thang sai dinh dang, truoc khi cham database", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(session());

    const response = await GET_DETAIL(
      new Request("http://localhost/api/payslips/thang-bay"),
      { params: Promise.resolve({ month: "thang-bay" }) },
    );

    expect(response.status).toBe(400);
    expect(vi.mocked(createServerSupabase)).not.toHaveBeenCalled();
  });
});
