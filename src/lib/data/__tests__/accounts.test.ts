import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionContext } from "@/lib/auth/session-context";
import {
  changeOwnPassword,
  completeForcedPasswordChange,
  createEmployeeAccount,
  setEmployeePassword,
} from "@/lib/data/mutations/accounts";
import {
  ACCOUNT_LABELS,
  CHANGE_OWN_PASSWORD_LABELS,
  CHANGE_PASSWORD_LABELS,
  RESET_PASSWORD_LABELS,
} from "@/lib/constants";
import { logMutation } from "@/lib/data/audit";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { createVerificationSupabase } from "@/lib/supabase/verify";

/**
 * Nam khang dinh cua Task 3 (02-10-PLAN.md) tap trung vao THU TU va CHONG
 * MAC KET, khong phai vao viec "goi duoc API" — dung khuon mock cua
 * `employees.test.ts` (`vi.mock` + `importOriginal` cho session-context de
 * giu nguyen `requireRole`/loi that, chi thay `getSessionContext`).
 */

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: vi.fn() }));
vi.mock("@/lib/supabase/verify", () => ({ createVerificationSupabase: vi.fn() }));

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

    await expect(createEmployeeAccount("emp-1", VALID_PASSWORD)).rejects.toThrow(
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

    await createEmployeeAccount("emp-1", VALID_PASSWORD);

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

    await createEmployeeAccount("emp-1", VALID_PASSWORD);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ user_id: "user-new" });
  });
});

/* -------------------------------------------------------------------------- */
/* setEmployeePassword — quan tri dat lai mat khau (spec 2026-09-06)          */
/* -------------------------------------------------------------------------- */

function adminSession(role: "owner" | "admin" | "manager" | "employee") {
  return {
    userId: "user-admin",
    email: "admin@timeflow.test",
    companyId: "cty-01",
    role,
    employeeId: null,
    isPlatformAdmin: false,
    mustChangePassword: false,
  };
}

/** Admin client gia chi phuc vu duong dat lai mat khau. */
function adminThatUpdatesUser(
  error: { message?: string } | null = null,
): FakeAdminClient {
  return {
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({
          data: { user: { id: "user-target" } },
          error,
        }),
        createUser: vi.fn(),
      },
    },
  } as unknown as FakeAdminClient;
}

const VALID_PASSWORD = "matkhau-moi-2026";

describe("setEmployeePassword — quyen, ranh gioi va thu tu (spec 2026-09-06)", () => {
  beforeEach(() => {
    // `logMutation` la mock cap module (khong phai spy), nen `restoreAllMocks`
    // khong xoa lich su goi cua cac describe truoc — phai tu xoa de khang dinh
    // "goi dung 1 lan" o bai 14 noi ve DUNG bai do.
    vi.mocked(logMutation).mockClear();
  });

  /**
   * Moi khang dinh o day deu di kem "VA khong goi updateUserById". Kiem tra
   * loi duoc nem la CHUA DU: mot ban cai dat chan sai thu tu van nem dung loi
   * nhung DA KIP doi mat khau roi — dung thu can chan.
   */

  it("8. Manager goi -> bi tu choi VA khong cham Admin API", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(adminSession("manager"));
    const admin = adminThatUpdatesUser();
    vi.mocked(createAdminSupabase).mockReturnValue(admin);

    await expect(
      setEmployeePassword("emp-1", VALID_PASSWORD),
    ).rejects.toThrow();

    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("9. Employee goi -> bi tu choi VA khong cham Admin API", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(adminSession("employee"));
    const admin = adminThatUpdatesUser();
    vi.mocked(createAdminSupabase).mockReturnValue(admin);

    await expect(
      setEmployeePassword("emp-1", VALID_PASSWORD),
    ).rejects.toThrow();

    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("10. Nhan vien cua doanh nghiep khac -> khong tim thay VA khong cham Admin API", async () => {
    // `.eq("company_id")` cua ham that lam dong nay khong tra ve gi. Client
    // gia dung `beforeRow: null` de dien ta dung tinh huong do.
    vi.mocked(getSessionContext).mockResolvedValue(adminSession("admin"));
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeServerSupabaseForAccountLookup({ beforeRow: null }),
    );
    const admin = adminThatUpdatesUser();
    vi.mocked(createAdminSupabase).mockReturnValue(admin);

    await expect(setEmployeePassword("emp-cty-02", VALID_PASSWORD)).rejects.toThrow(
      "Không tìm thấy nhân viên.",
    );

    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("11. Nhan vien chua co tai khoan -> bao loi VA khong cham Admin API", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(adminSession("admin"));
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeServerSupabaseForAccountLookup({ beforeRow: employeeRow({ user_id: null }) }),
    );
    const admin = adminThatUpdatesUser();
    vi.mocked(createAdminSupabase).mockReturnValue(admin);

    await expect(setEmployeePassword("emp-1", VALID_PASSWORD)).rejects.toThrow(
      RESET_PASSWORD_LABELS.noAccountError,
    );

    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("12. Mat khau ngan hon 8 ky tu -> bi chan O SERVER VA khong cham Admin API", async () => {
    // Form da kiem, nhung Server Action khong duoc tin tham so tu client.
    vi.mocked(getSessionContext).mockResolvedValue(adminSession("admin"));
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeServerSupabaseForAccountLookup({
        beforeRow: employeeRow({ user_id: "user-target" }),
      }),
    );
    const admin = adminThatUpdatesUser();
    vi.mocked(createAdminSupabase).mockReturnValue(admin);

    await expect(setEmployeePassword("emp-1", "1234567")).rejects.toThrow(
      RESET_PASSWORD_LABELS.tooShortError,
    );

    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("13. Duong thanh cong -> doi mat khau VA xoa co must_change_password", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(adminSession("admin"));
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeServerSupabaseForAccountLookup({
        beforeRow: employeeRow({ user_id: "user-target" }),
      }),
    );
    const admin = adminThatUpdatesUser();
    vi.mocked(createAdminSupabase).mockReturnValue(admin);

    const result = await setEmployeePassword("emp-1", VALID_PASSWORD);

    expect(result).toEqual({ email: "cuonglm@pamoteam.com" });
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith("user-target", {
      password: VALID_PASSWORD,
      // PHAI la `false` chu khong duoc vang mat: nhan vien duoc tao tai khoan
      // nhung chua dang nhap lan nao van dang mang co `true`, de nguyen thi ho
      // bi da sang man hinh bat doi mat khau.
      app_metadata: { must_change_password: false },
    });
  });

  it("14. Ban ghi audit khong chua mat khau o BAT KY khoa hay gia tri nao", async () => {
    vi.mocked(getSessionContext).mockResolvedValue(adminSession("owner"));
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeServerSupabaseForAccountLookup({
        beforeRow: employeeRow({ user_id: "user-target" }),
      }),
    );
    vi.mocked(createAdminSupabase).mockReturnValue(adminThatUpdatesUser());

    await setEmployeePassword("emp-1", VALID_PASSWORD);

    expect(logMutation).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(logMutation).mock.calls[0][0];
    expect(entry.entityTable).toBe("auth.users");
    expect(entry.entityId).toBe("user-target");

    // Quet TOAN BO ban ghi da tuan tu hoa: mat khau khong duoc nam o khoa nao,
    // gia tri nao, du long den dau.
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain(VALID_PASSWORD);
    for (const needle of ["password", "secret", "token"]) {
      for (const key of Object.keys(entry.after ?? {})) {
        expect(key.toLowerCase()).not.toContain(needle);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* changeOwnPassword — nguoi dung tu doi mat khau (spec 2026-09-06)           */
/* -------------------------------------------------------------------------- */

const OWN_SESSION = {
  userId: "user-self",
  email: "self@timeflow.test",
  companyId: "cty-01",
  role: "employee" as const,
  employeeId: "emp-self",
  isPlatformAdmin: false,
  mustChangePassword: false,
};

const CURRENT_PASSWORD = "matkhau-cu-2026";
const NEW_PASSWORD = "matkhau-moi-2026";

/**
 * Client cookie-bound gia. Co CA `signInWithPassword` — khong phai vi ham that
 * duoc phep goi no, ma NGUOC LAI: de bai 19 khang dinh duoc rang no khong bao
 * gio bi goi. Mot mock thieu ham do se nem TypeError va bai test do vi ly do
 * sai.
 */
function fakeCookieClientForOwnChange(options: {
  callOrder: string[];
  updateUserError?: { message?: string } | null;
}): FakeServerClient {
  return {
    auth: {
      signInWithPassword: vi.fn(async () => {
        options.callOrder.push("cookieSignIn");
        return { data: {}, error: null };
      }),
      updateUser: vi.fn(async () => {
        options.callOrder.push("updatePassword");
        return { data: {}, error: options.updateUserError ?? null };
      }),
    },
  } as unknown as FakeServerClient;
}

function fakeVerifierClient(options: {
  callOrder: string[];
  signInError?: { message?: string } | null;
}): ReturnType<typeof createVerificationSupabase> {
  return {
    auth: {
      signInWithPassword: vi.fn(async () => {
        options.callOrder.push("verify");
        return { data: {}, error: options.signInError ?? null };
      }),
    },
  } as unknown as ReturnType<typeof createVerificationSupabase>;
}

describe("changeOwnPassword — xac minh truoc, doi sau (spec 2026-09-06)", () => {
  beforeEach(() => {
    vi.mocked(logMutation).mockClear();
    vi.mocked(createVerificationSupabase).mockReset();
    vi.mocked(getSessionContext).mockResolvedValue(OWN_SESSION);
  });

  it("15. Mat khau hien tai sai -> bao loi VA khong doi mat khau", async () => {
    const callOrder: string[] = [];
    const cookieClient = fakeCookieClientForOwnChange({ callOrder });
    vi.mocked(createServerSupabase).mockResolvedValue(cookieClient);
    vi.mocked(createVerificationSupabase).mockReturnValue(
      fakeVerifierClient({ callOrder, signInError: { message: "Invalid login" } }),
    );

    await expect(
      changeOwnPassword("mat-khau-sai-roi", NEW_PASSWORD),
    ).rejects.toThrow(CHANGE_OWN_PASSWORD_LABELS.wrongCurrentError);

    expect(cookieClient.auth.updateUser).not.toHaveBeenCalled();
    expect(callOrder).toEqual(["verify"]);
  });

  it("16. Mat khau moi ngan hon 8 ky tu -> chan O SERVER, khong xac minh, khong doi", async () => {
    const callOrder: string[] = [];
    const cookieClient = fakeCookieClientForOwnChange({ callOrder });
    vi.mocked(createServerSupabase).mockResolvedValue(cookieClient);
    const verifier = fakeVerifierClient({ callOrder });
    vi.mocked(createVerificationSupabase).mockReturnValue(verifier);

    await expect(changeOwnPassword(CURRENT_PASSWORD, "1234567")).rejects.toThrow(
      CHANGE_OWN_PASSWORD_LABELS.tooShortError,
    );

    // Duong hong khong duoc tao ra mot lan dang nhap xac minh nao.
    expect(verifier.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(cookieClient.auth.updateUser).not.toHaveBeenCalled();
  });

  it("17. Mat khau moi trung mat khau cu -> chan, khong xac minh, khong doi", async () => {
    const callOrder: string[] = [];
    const cookieClient = fakeCookieClientForOwnChange({ callOrder });
    vi.mocked(createServerSupabase).mockResolvedValue(cookieClient);
    const verifier = fakeVerifierClient({ callOrder });
    vi.mocked(createVerificationSupabase).mockReturnValue(verifier);

    await expect(
      changeOwnPassword(CURRENT_PASSWORD, CURRENT_PASSWORD),
    ).rejects.toThrow(CHANGE_OWN_PASSWORD_LABELS.sameAsCurrentError);

    expect(verifier.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(cookieClient.auth.updateUser).not.toHaveBeenCalled();
  });

  it("18. Duong thanh cong -> xac minh TRUOC, doi mat khau SAU", async () => {
    const callOrder: string[] = [];
    const cookieClient = fakeCookieClientForOwnChange({ callOrder });
    vi.mocked(createServerSupabase).mockResolvedValue(cookieClient);
    const verifier = fakeVerifierClient({ callOrder });
    vi.mocked(createVerificationSupabase).mockReturnValue(verifier);

    await changeOwnPassword(CURRENT_PASSWORD, NEW_PASSWORD);

    expect(callOrder).toEqual(["verify", "updatePassword"]);
    expect(verifier.auth.signInWithPassword).toHaveBeenCalledWith({
      email: OWN_SESSION.email,
      password: CURRENT_PASSWORD,
    });
    expect(cookieClient.auth.updateUser).toHaveBeenCalledWith({
      password: NEW_PASSWORD,
    });
  });

  it("19. Xac minh dung client TACH ROI, KHONG dung client cookie-bound", async () => {
    /**
     * Bai quan trong nhat cua nhom nay. `signInWithPassword` goi tren client
     * cookie-bound se GHI DE cookie phien — nguoi dung dang doi mat khau bong
     * dung bi cap lai phien, hoac mat phien khi go sai. Loi do khong lam bai
     * nao khac do, va trieu chung ngoai doi (thinh thoang mat phien) rat kho
     * lan ra nguon.
     */
    const callOrder: string[] = [];
    const cookieClient = fakeCookieClientForOwnChange({ callOrder });
    vi.mocked(createServerSupabase).mockResolvedValue(cookieClient);
    const verifier = fakeVerifierClient({ callOrder });
    vi.mocked(createVerificationSupabase).mockReturnValue(verifier);

    await changeOwnPassword(CURRENT_PASSWORD, NEW_PASSWORD);

    expect(verifier.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(cookieClient.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(callOrder).not.toContain("cookieSignIn");
  });

  it("20. Ban ghi audit khong chua mat khau o BAT KY khoa hay gia tri nao", async () => {
    const callOrder: string[] = [];
    vi.mocked(createServerSupabase).mockResolvedValue(
      fakeCookieClientForOwnChange({ callOrder }),
    );
    vi.mocked(createVerificationSupabase).mockReturnValue(
      fakeVerifierClient({ callOrder }),
    );

    await changeOwnPassword(CURRENT_PASSWORD, NEW_PASSWORD);

    expect(logMutation).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(logMutation).mock.calls[0][0];
    expect(entry.entityTable).toBe("auth.users");
    expect(entry.entityId).toBe(OWN_SESSION.userId);

    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain(NEW_PASSWORD);
    expect(serialized).not.toContain(CURRENT_PASSWORD);
    for (const needle of ["password", "secret", "token"]) {
      for (const key of Object.keys(entry.after ?? {})) {
        expect(key.toLowerCase()).not.toContain(needle);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* createEmployeeAccount — mat khau do quan tri dat (spec 2026-09-06)         */
/* -------------------------------------------------------------------------- */

describe("createEmployeeAccount — mat khau quan tri dat, khong bat doi lan dau", () => {
  beforeEach(() => {
    vi.mocked(getSessionContext).mockResolvedValue(adminSession("admin"));
  });

  it("21. Mat khau ngan hon 8 ky tu -> chan O SERVER VA khong goi createUser", async () => {
    const admin = adminThatCreatesUser("user-new");
    vi.mocked(createAdminSupabase).mockReturnValue(admin);
    const { client } = fakeServerSupabaseForAccountCreate(employeeRow());
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    await expect(createEmployeeAccount("emp-1", "1234567")).rejects.toThrow(
      ACCOUNT_LABELS.tooShortError,
    );

    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("22. Tao tai khoan bang DUNG mat khau quan tri dua vao, va KHONG bat doi lan dau", async () => {
    const admin = adminThatCreatesUser("user-new");
    vi.mocked(createAdminSupabase).mockReturnValue(admin);
    const { client } = fakeServerSupabaseForAccountCreate(employeeRow());
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const result = await createEmployeeAccount("emp-1", VALID_PASSWORD);

    expect(result).toEqual({ email: "cuonglm@pamoteam.com" });
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({
      email: "cuonglm@pamoteam.com",
      password: VALID_PASSWORD,
      email_confirm: true,
      // `false`, KHONG phai `true`: bo buoc doi mat khau lan dau la quyet dinh
      // co chu dich cua spec 2026-09-06, khong phai sot.
      app_metadata: { must_change_password: false },
    });
  });

  it("23. Ket qua tra ve KHONG mang mat khau di theo", async () => {
    // Truoc day ham nay tra ve `temporaryPassword`. Gio quan tri tu go nen
    // khong con ly do gi de mat khau roi khoi ham.
    vi.mocked(createAdminSupabase).mockReturnValue(adminThatCreatesUser("user-new"));
    const { client } = fakeServerSupabaseForAccountCreate(employeeRow());
    vi.mocked(createServerSupabase).mockResolvedValue(client);

    const result = await createEmployeeAccount("emp-1", VALID_PASSWORD);

    expect(JSON.stringify(result)).not.toContain(VALID_PASSWORD);
    expect(Object.keys(result)).toEqual(["email"]);
  });
});
