// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT (khuon `holidays-mutations.test.ts`).
// Khac cac test tich hop truoc do o MOT diem quan trong: `createServerSupabase`
// KHONG mock ve client khoa service, ma ve mot client mang JWT THAT cua mot
// platform admin dung-mot-lan. Phai vay vi toan bo hanh vi duoc kiem o day
// (`tf_is_platform_admin()`, `tf_has_support_access()`, policy insert cua
// `support_sessions` va cua `audit_log`) deu suy tu `auth.uid()` — mot client
// khoa service bo qua RLS se lam moi khang dinh o day thanh vo nghia.
import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/auth/session-context";
import {
  closeSupportSession,
  getActiveSupportSession,
  openSupportSession,
} from "@/lib/data/mutations/platform-sessions";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

/** Kho cookie trong bo nho — thay `next/headers` trong moi truong test. */
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

const COMPANY_ID = "cty-01";
const OTHER_COMPANY_ID = "cty-02";
const ACTIVE_COMPANY_COOKIE = "tf_active_company";

describe("Vòng đời phiên hỗ trợ (D-49, D-55)", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secretKey || !publishableKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — test này chạy trên Postgres dev thật, cần .env.local.",
    );
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const password = `Support!${randomBytes(8).toString("hex")}`;
  const adminEmail = `pa-${randomBytes(5).toString("hex")}@timeflow.test`;
  const outsiderEmail = `out-${randomBytes(5).toString("hex")}@timeflow.test`;

  let platformAdminId = "";
  let outsiderId = "";
  let asPlatformAdmin: SupabaseClient;
  let asOutsider: SupabaseClient;
  const createdSessionIds: string[] = [];

  /**
   * Tra ve CHINH client da dang nhap, khong phai mot client moi gan header
   * `Authorization` tay: `getAuthenticatedUser()` doc danh tinh qua
   * `supabase.auth.getClaims()`, ma ham do lay tu PHIEN cua client chu khong
   * tu header. Mot client chi co header se qua duoc PostgREST nhung tra
   * `UnauthenticatedError` ngay o buoc kiem danh tinh.
   */
  async function signInAs(email: string): Promise<SupabaseClient> {
    const client = createClient(url!, publishableKey!, {
      auth: { persistSession: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw new Error(`Không đăng nhập được ${email}: ${error?.message}`);
    }
    return client;
  }

  /** Doi danh tinh ma `createServerSupabase()` se tra ve o loi goi ke tiep. */
  async function actAs(client: SupabaseClient): Promise<void> {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    vi.mocked(createServerSupabase).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
  }

  beforeAll(async () => {
    for (const [email, isPlatformAdmin] of [
      [adminEmail, true],
      [outsiderEmail, false],
    ] as const) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`Không tạo được tài khoản ${email}: ${error?.message}`);
      }
      if (isPlatformAdmin) {
        platformAdminId = data.user.id;
        const { error: paError } = await admin
          .from("platform_admins")
          .insert({ user_id: data.user.id });
        if (paError) throw new Error(`platform_admins: ${paError.message}`);
      } else {
        outsiderId = data.user.id;
      }
    }

    asPlatformAdmin = await signInAs(adminEmail);
    asOutsider = await signInAs(outsiderEmail);
  });

  afterAll(async () => {
    for (const id of createdSessionIds) {
      await admin.from("support_sessions").delete().eq("id", id);
    }
    await admin.from("support_sessions").delete().eq("platform_admin_id", platformAdminId);
    await admin.from("audit_log").delete().eq("actor_user_id", platformAdminId);
    await admin.from("platform_admins").delete().eq("user_id", platformAdminId);
    if (platformAdminId) await admin.auth.admin.deleteUser(platformAdminId);
    if (outsiderId) await admin.auth.admin.deleteUser(outsiderId);
    cookieJar.clear();
  });

  it("từ chối người không phải platform admin", async () => {
    await actAs(asOutsider);
    await expect(openSupportSession(COMPANY_ID, "Ticket #418")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("từ chối khi lý do rỗng — một phiên không lý do là một dòng nhật ký vô nghĩa", async () => {
    await actAs(asPlatformAdmin);
    await expect(openSupportSession(COMPANY_ID, "   ")).rejects.toThrow(
      "Vui lòng nhập lý do mở phiên hỗ trợ.",
    );

    // Va khong de lai dong nao — tu choi phai xay ra TRUOC khi cham database.
    const { data } = await admin
      .from("support_sessions")
      .select("id")
      .eq("platform_admin_id", platformAdminId);
    expect(data ?? []).toHaveLength(0);
  });

  it("mở phiên: ghi support_sessions, một dòng audit action='access', và đặt cookie", async () => {
    await actAs(asPlatformAdmin);
    await openSupportSession(COMPANY_ID, "Ticket #418");

    const { data: sessions } = await admin
      .from("support_sessions")
      .select("id, company_id, reason, closed_at, opened_at, expires_at")
      .eq("platform_admin_id", platformAdminId);
    expect(sessions ?? []).toHaveLength(1);
    const session = (sessions ?? [])[0];
    createdSessionIds.push(session.id);
    expect(session.company_id).toBe(COMPANY_ID);
    expect(session.reason).toBe("Ticket #418");
    expect(session.closed_at).toBeNull();

    // 60 phut, cho lech vai giay do vong mang.
    const lifetimeMinutes =
      (new Date(session.expires_at).getTime() - new Date(session.opened_at).getTime()) / 60_000;
    expect(lifetimeMinutes).toBeGreaterThan(59);
    expect(lifetimeMinutes).toBeLessThan(61);

    const { data: audit } = await admin
      .from("audit_log")
      .select("action, company_id, entity_table, entity_id, reason")
      .eq("actor_user_id", platformAdminId);
    expect(audit ?? []).toHaveLength(1);
    expect((audit ?? [])[0]).toMatchObject({
      action: "access",
      company_id: COMPANY_ID,
      entity_table: "support_sessions",
      entity_id: session.id,
      reason: "Mở phiên hỗ trợ: Ticket #418",
    });

    expect(cookieJar.get(ACTIVE_COMPANY_COOKIE)).toBe(COMPANY_ID);
  });

  it("getActiveSupportSession trả phiên đang mở của CHÍNH người gọi", async () => {
    await actAs(asPlatformAdmin);
    const active = await getActiveSupportSession();
    expect(active).not.toBeNull();
    expect(active?.companyId).toBe(COMPANY_ID);
  });

  it("người khác không thấy phiên đó là của mình — bộ lọc theo người gọi, không phó mặc RLS", async () => {
    // `outsider` la thanh vien cty-01? Khong — nhung ke ca khi la thanh vien,
    // policy select cua support_sessions CO Y cho ho doc dong nay. Khang dinh
    // o day la getActiveSupportSession() van tra null vi no loc theo auth.uid().
    await actAs(asOutsider);
    expect(await getActiveSupportSession()).toBeNull();
  });

  it("đóng phiên: đặt closed_at, ghi dòng audit thứ hai, xoá cookie", async () => {
    await actAs(asPlatformAdmin);
    await closeSupportSession();

    const { data: sessions } = await admin
      .from("support_sessions")
      .select("closed_at")
      .eq("platform_admin_id", platformAdminId);
    expect((sessions ?? [])[0]?.closed_at).not.toBeNull();

    const { data: audit } = await admin
      .from("audit_log")
      .select("action, reason")
      .eq("actor_user_id", platformAdminId)
      .order("created_at", { ascending: true });
    expect(audit ?? []).toHaveLength(2);
    expect((audit ?? [])[1]).toMatchObject({
      action: "access",
      reason: "Đóng phiên hỗ trợ",
    });

    expect(cookieJar.has(ACTIVE_COMPANY_COOKIE)).toBe(false);
    expect(await getActiveSupportSession()).toBeNull();
  });

  it("mở phiên vào doanh nghiệp khác thì cookie đổi theo — phiên chỉ mở đúng một nơi", async () => {
    await actAs(asPlatformAdmin);
    await openSupportSession(OTHER_COMPANY_ID, "Ticket #419");

    const active = await getActiveSupportSession();
    expect(active?.companyId).toBe(OTHER_COMPANY_ID);
    expect(cookieJar.get(ACTIVE_COMPANY_COOKIE)).toBe(OTHER_COMPANY_ID);

    await closeSupportSession();
  });
});
