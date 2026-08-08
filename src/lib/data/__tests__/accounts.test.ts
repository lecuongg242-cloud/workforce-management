import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionContext } from "@/lib/auth/session-context";
import {
  completeForcedPasswordChange,
  createEmployeeAccount,
} from "@/lib/data/mutations/accounts";
import { CHANGE_PASSWORD_LABELS } from "@/lib/constants";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Nam khang dinh cua Task 3 (02-10-PLAN.md) tap trung vao THU TU va CHONG
 * MAC KET, khong phai vao viec "goi duoc API" — dung khuon mock cua
 * `employees.test.ts` (`vi.mock` + `importOriginal` cho session-context de
 * giu nguyen `requireRole`/loi that, chi thay `getSessionContext`).
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: vi.fn() }));

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

type FakeServerClient = Awaited<ReturnType<typeof createServerSupabase>>;
type FakeAdminClient = ReturnType<typeof createAdminSupabase>;

beforeEach(() => {
  vi.mocked(getSessionContext).mockReset();
  vi.mocked(createServerSupabase).mockReset();
  vi.mocked(createAdminSupabase).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const SESSION_MUST_CHANGE = {
  userId: "user-1",
  email: "user1@timeflow.test",
  companyId: "cty-01",
  role: "employee" as const,
  employeeId: "emp-1",
  isPlatformAdmin: false,
  mustChangePassword: true,
};

interface RefreshOutcome {
  error: { message?: string; code?: string } | null;
}

function fakeServerSupabaseForPasswordChange(options: {
  callOrder: string[];
  updateUserError?: { message?: string } | null;
  refreshResults: RefreshOutcome[];
}): FakeServerClient {
  let refreshCallCount = 0;
  const client = {
    auth: {
      updateUser: vi.fn(async () => {
        options.callOrder.push("updatePassword");
        return { data: {}, error: options.updateUserError ?? null };
      }),
      refreshSession: vi.fn(async () => {
        options.callOrder.push("refreshSession");
        const outcome =
          options.refreshResults[refreshCallCount] ??
          options.refreshResults[options.refreshResults.length - 1] ??
          { error: null };
        refreshCallCount += 1;
        return outcome;
      }),
    },
  };
  return client as unknown as FakeServerClient;
}

function fakeAdminSupabaseForPasswordChange(options: {
  callOrder: string[];
  updateUserByIdError?: { message?: string } | null;
}): FakeAdminClient {
  const client = {
    auth: {
      admin: {
        updateUserById: vi.fn(async () => {
          options.callOrder.push("clearFlag");
          return { data: {}, error: options.updateUserByIdError ?? null };
        }),
        createUser: vi.fn(),
      },
    },
  };
  return client as unknown as FakeAdminClient;
}

describe("completeForcedPasswordChange — thu tu va chong mac ket (D-16a, T-02-10)", () => {
  it("1. Trinh tu thanh cong goi DUNG thu tu: doi mat khau -> xoa co -> lam moi phien", async () => {
    const callOrder: string[] = [];
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_MUST_CHANGE);
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeServerSupabaseForPasswordChange({
        callOrder,
        refreshResults: [{ error: null }],
      }),
    );
    vi.mocked(createAdminSupabase).mockReturnValue(
      fakeAdminSupabaseForPasswordChange({ callOrder }),
    );

    await completeForcedPasswordChange("mat-khau-moi-manh-01");

    expect(callOrder).toEqual(["updatePassword", "clearFlag", "refreshSession"]);
  });

  it("2. Buoc doi mat khau that bai -> nem loi loai 'chua doi duoc' VA khong goi buoc xoa co", async () => {
    const callOrder: string[] = [];
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_MUST_CHANGE);
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeServerSupabaseForPasswordChange({
        callOrder,
        updateUserError: { message: "weak password" },
        refreshResults: [{ error: null }],
      }),
    );
    const admin = fakeAdminSupabaseForPasswordChange({ callOrder });
    vi.mocked(createAdminSupabase).mockReturnValue(admin);

    await expect(
      completeForcedPasswordChange("mat-khau-moi-manh-02"),
    ).rejects.toThrow(CHANGE_PASSWORD_LABELS.notChangedErrorFallback);

    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
    expect(callOrder).toEqual(["updatePassword"]);
  });

  it("3. Buoc lam moi phien loi 'refresh token da dung' lan dau -> goi lai DUNG MOT lan nua (2 lan, khong phai 1 hay 3)", async () => {
    const callOrder: string[] = [];
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_MUST_CHANGE);
    const server = fakeServerSupabaseForPasswordChange({
      callOrder,
      refreshResults: [
        { error: { code: "refresh_token_already_used", message: "refresh token already used" } },
        { error: null },
      ],
    });
    vi.mocked(createServerSupabase).mockResolvedValue(server);
    vi.mocked(createAdminSupabase).mockReturnValue(
      fakeAdminSupabaseForPasswordChange({ callOrder }),
    );

    await completeForcedPasswordChange("mat-khau-moi-manh-03");

    expect(server.auth.refreshSession).toHaveBeenCalledTimes(2);
  });

  it("4. Ca hai lan lam moi deu that bai -> nem loi loai 'da doi nhung phai dang nhap lai', thong diep KHAC voi loi cua truong hop 2", async () => {
    const callOrder: string[] = [];
    vi.mocked(getSessionContext).mockResolvedValue(SESSION_MUST_CHANGE);
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeServerSupabaseForPasswordChange({
        callOrder,
        refreshResults: [
          { error: { code: "refresh_token_already_used", message: "refresh token already used" } },
          { error: { code: "refresh_token_already_used", message: "refresh token already used" } },
        ],
      }),
    );
    vi.mocked(createAdminSupabase).mockReturnValue(
      fakeAdminSupabaseForPasswordChange({ callOrder }),
    );

    await expect(
      completeForcedPasswordChange("mat-khau-moi-manh-04"),
    ).rejects.toThrow(CHANGE_PASSWORD_LABELS.changedButSessionStaleError);

    // Dieu kien de nguoi dung KHONG thu lai bang mat khau cu (T-02-10-07):
    // hai thong diep loi phai la hai chuoi KHAC NHAU.
    expect(CHANGE_PASSWORD_LABELS.changedButSessionStaleError).not.toEqual(
      CHANGE_PASSWORD_LABELS.notChangedErrorFallback,
    );
  });
});

function fakeServerSupabaseForAccountLookup(options: {
  beforeRow: Record<string, unknown> | null;
}): FakeServerClient {
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
    }),
  };
  return client as unknown as FakeServerClient;
}

describe("createEmployeeAccount — chan tao trung (T-02-10)", () => {
  it("5. Nhan vien da co tai khoan lien ket -> nem loi VA khong goi API tao nguoi dung", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({
      userId: "user-admin",
      email: "admin@timeflow.test",
      companyId: "cty-01",
      role: "admin",
      employeeId: null,
      isPlatformAdmin: false,
      mustChangePassword: false,
    });
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeServerSupabaseForAccountLookup({
        beforeRow: { id: "emp-1", company_id: "cty-01", user_id: "user-existing" },
      }),
    );
    const admin = fakeAdminSupabaseForPasswordChange({ callOrder: [] });
    vi.mocked(createAdminSupabase).mockReturnValue(admin);

    await expect(createEmployeeAccount("emp-1")).rejects.toThrow(
      "Nhân viên này đã có tài khoản đăng nhập.",
    );

    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* Trang thai ho so sau khi tao tai khoan                                      */
/* -------------------------------------------------------------------------- */

/** Mot dong `employees` day du de `employeeRowSchema` parse duoc. */
function employeeRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "emp-1",
    company_id: "cty-01",
    code: "NV023",
    full_name: "lecuong",
    email: "cuonglm@pamoteam.com",
    phone: null,
    date_of_birth: null,
    gender: null,
    avatar_url: null,
    department_id: "dept-01",
    position: null,
    contract_type: null,
    start_date: "2026-08-07",
    manager_id: null,
    shift_id: "sft-01-morning",
    work_location: "Văn phòng chính",
    status: "pending_invite",
    system_role: "employee",
    invitation_sent: true,
    can_view_payslip: true,
    can_check_in_remotely: false,
    user_id: null,
    ...overrides,
  };
}

/**
 * Client gia di het duong tao tai khoan: doc dong truoc, chen membership, roi
 * cap nhat `employees`. Ghi lai payload cua `.update()` — day la thu bai test
 * duoi day doc.
 */
function fakeServerSupabaseForAccountCreate(beforeRow: Record<string, unknown>): {
  client: FakeServerClient;
  updates: Record<string, unknown>[];
  membershipInserts: Record<string, unknown>[];
} {
  const updates: Record<string, unknown>[] = [];
  const membershipInserts: Record<string, unknown>[] = [];

  const client = {
    from: vi.fn((table: string) => {
      if (table === "memberships") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            membershipInserts.push(payload);
            return { error: null };
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: beforeRow, error: null }),
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: { ...beforeRow, ...payload },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        },
      };
    }),
  };

  return {
    client: client as unknown as FakeServerClient,
    updates,
    membershipInserts,
  };
}

function adminThatCreatesUser(newUserId: string): FakeAdminClient {
  return {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: { user: { id: newUserId } },
          error: null,
        }),
      },
    },
  } as unknown as FakeAdminClient;
}

describe("createEmployeeAccount — hồ sơ thôi 'chưa kích hoạt' ngay khi có tài khoản", () => {
  beforeEach(() => {
    vi.mocked(getSessionContext).mockResolvedValue({
      userId: "user-admin",
      email: "admin@timeflow.test",
      companyId: "cty-01",
      role: "admin",
      employeeId: null,
      isPlatformAdmin: false,
      mustChangePassword: false,
    });
    vi.mocked(createAdminSupabase).mockReturnValue(
      adminThatCreatesUser("user-new"),
    );
  });

  it("6. pending_invite -> active, cùng một lần ghi với user_id", async () => {
    const { client, updates } = fakeServerSupabaseForAccountCreate(employeeRow());
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    await createEmployeeAccount("emp-1");

    expect(updates).toHaveLength(1);
    // Mot lan ghi duy nhat mang CA HAI cot: hai lan ghi rieng se de lai mot
    // khoang thoi gian ma ho so co tai khoan nhung van bao "chua kich hoat".
    expect(updates[0]).toEqual({ user_id: "user-new", status: "active" });
  });

  it("7. KHÔNG ghi đè trạng thái khác pending_invite", async () => {
    // Nguoi dang nghi phep duoc cap tai khoan van phai giu `on_leave`. Dat
    // cung "active" o day la dung mot su that nghiep vu de sua mot nhan hien
    // thi — va lam bien mat viec ho dang nghi.
    const { client, updates } = fakeServerSupabaseForAccountCreate(
      employeeRow({ status: "on_leave" }),
    );
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    await createEmployeeAccount("emp-1");

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ user_id: "user-new" });
  });
});
