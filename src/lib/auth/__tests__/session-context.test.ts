import { readFileSync } from "node:fs";
import path from "node:path";

import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_COMPANY_COOKIE,
  NoActiveCompanyError,
  NoMembershipError,
  UnauthenticatedError,
  canAccessAdminArea,
  getSessionContext,
  homePathForRole,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Test doi khang cho D-12a/D-12b/AUTH-03: `getSessionContext()` la diem
 * chan danh tinh duy nhat va khong bao gio tu chon membership dau tien khi
 * co nhieu lua chon (delta gia dinh cua Phase 2).
 */

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

type FakeClient = Awaited<ReturnType<typeof createServerSupabase>>;

interface MembershipRow {
  company_id: string;
  role: "owner" | "admin" | "manager" | "employee";
}

function fakeClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: "user-1",
    email: "user1@example.test",
    app_metadata: {},
    ...overrides,
  };
}

function createFakeSupabase(options: {
  claims: ReturnType<typeof fakeClaims> | null;
  membershipRows: MembershipRow[];
  employeeRow?: { id: string } | null;
  isPlatformAdmin?: boolean;
}): FakeClient {
  const client = {
    auth: {
      getClaims: async () =>
        options.claims ? { data: { claims: options.claims } } : { data: null },
    },
    from: (table: string) => {
      if (table === "memberships") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: options.membershipRows,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "employees") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: options.employeeRow ?? null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Bảng không được mock trong test này: ${table}`);
    },
    rpc: async () => ({
      data: options.isPlatformAdmin ?? false,
      error: null,
    }),
  };
  return client as unknown as FakeClient;
}

function mockCookie(value: string | null): void {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      value !== null && name === ACTIVE_COMPANY_COOKIE
        ? { name, value }
        : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

beforeEach(() => {
  vi.mocked(createServerSupabase).mockReset();
  vi.mocked(cookies).mockReset();
});

describe("getSessionContext", () => {
  it("khong co claims -> nem UnauthenticatedError", async () => {
    vi.mocked(createServerSupabase).mockResolvedValue(
      createFakeSupabase({ claims: null, membershipRows: [] }),
    );
    mockCookie(null);

    await expect(getSessionContext()).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("co claims, 0 membership active -> nem NoMembershipError", async () => {
    vi.mocked(createServerSupabase).mockResolvedValue(
      createFakeSupabase({ claims: fakeClaims(), membershipRows: [] }),
    );
    mockCookie(null);

    await expect(getSessionContext()).rejects.toBeInstanceOf(
      NoMembershipError,
    );
  });

  it("co claims, dung 1 membership active, khong cookie -> tra ve dung companyId/role", async () => {
    vi.mocked(createServerSupabase).mockResolvedValue(
      createFakeSupabase({
        claims: fakeClaims(),
        membershipRows: [{ company_id: "cty-01", role: "owner" }],
      }),
    );
    mockCookie(null);

    const context = await getSessionContext();
    expect(context.companyId).toBe("cty-01");
    expect(context.role).toBe("owner");
  });

  it("co claims, 2 membership active (hai vai tro khac nhau), khong cookie -> nem NoActiveCompanyError", async () => {
    // Test bat bien cua delta gia dinh: neu ai do sau nay "sua cho tien"
    // bang cach lay phan tu dau mang, test nay do.
    vi.mocked(createServerSupabase).mockResolvedValue(
      createFakeSupabase({
        claims: fakeClaims(),
        membershipRows: [
          { company_id: "cty-01", role: "owner" },
          { company_id: "cty-02", role: "manager" },
        ],
      }),
    );
    mockCookie(null);

    await expect(getSessionContext()).rejects.toBeInstanceOf(
      NoActiveCompanyError,
    );
  });

  it("cung du lieu nhu tren nhung cookie tro doanh nghiep thu hai -> tra ve doanh nghiep thu hai, khong phai thu nhat", async () => {
    vi.mocked(createServerSupabase).mockResolvedValue(
      createFakeSupabase({
        claims: fakeClaims(),
        membershipRows: [
          { company_id: "cty-01", role: "owner" },
          { company_id: "cty-02", role: "manager" },
        ],
      }),
    );
    mockCookie("cty-02");

    const context = await getSessionContext();
    expect(context.companyId).toBe("cty-02");
    expect(context.role).toBe("manager");
  });

  it("cookie tro toi mot doanh nghiep khong thuoc membership nao -> ket qua khong bao gio la doanh nghiep do (nem NoActiveCompanyError voi 2 membership khac)", async () => {
    vi.mocked(createServerSupabase).mockResolvedValue(
      createFakeSupabase({
        claims: fakeClaims(),
        membershipRows: [
          { company_id: "cty-01", role: "owner" },
          { company_id: "cty-02", role: "manager" },
        ],
      }),
    );
    mockCookie("cty-khong-phai-thanh-vien");

    await expect(getSessionContext()).rejects.toBeInstanceOf(
      NoActiveCompanyError,
    );
  });

  it("trang chu re theo vai tro: employee/manager vao giao dien nhan vien, owner/admin vao giao dien quan tri", () => {
    expect(homePathForRole("employee")).toBe("/employee");
    expect(homePathForRole("manager")).toBe("/employee");
    expect(homePathForRole("owner")).toBe("/admin/dashboard");
    expect(homePathForRole("admin")).toBe("/admin/dashboard");
  });

  it("khu vuc quan tri chi mo cho owner/admin — cung ranh gioi voi isAdminRole cua AUTH-03", () => {
    expect(canAccessAdminArea("owner")).toBe(true);
    expect(canAccessAdminArea("admin")).toBe(true);
    expect(canAccessAdminArea("manager")).toBe(false);
    expect(canAccessAdminArea("employee")).toBe(false);
  });

  it("khang dinh tinh: session-context.ts khong doc tham so truy van hay URL cua request", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "lib", "auth", "session-context.ts"),
      "utf8",
    );
    expect(/searchParams/.test(source)).toBe(false);
    expect(/new URL\(/.test(source)).toBe(false);
    expect(/req\.url|request\.url/.test(source)).toBe(false);
  });
});
