// @vitest-environment node
//
// Test TICH HOP tren Postgres/Auth dev THAT cho hai duong ghi trang cua super
// admin (SADM-04). `createServerSupabase` mock ve client mang JWT that cua
// mot platform admin dung-mot-lan; `createAdminSupabase` KHONG mock — hai ham
// nay di qua Admin API that, va do chinh la thu can duoc kiem.
import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/auth/session-context";
import {
  grantOwnerMembership,
  resetTempPasswordForUser,
} from "@/lib/data/mutations/platform";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

const COMPANY_ID = "cty-01";

describe("Hai đường ghi trắng của super admin (SADM-04)", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secretKey || !publishableKey) {
    throw new Error(
      "Thiếu biến môi trường Supabase — test này chạy trên Postgres dev thật, cần .env.local.",
    );
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const password = `Writes!${randomBytes(8).toString("hex")}`;
  const adminEmail = `pa-${randomBytes(5).toString("hex")}@timeflow.test`;
  const outsiderEmail = `out-${randomBytes(5).toString("hex")}@timeflow.test`;
  const victimEmail = `victim-${randomBytes(5).toString("hex")}@timeflow.test`;

  let platformAdminId = "";
  let outsiderId = "";
  let victimId = "";
  let asPlatformAdmin: SupabaseClient;
  let asOutsider: SupabaseClient;

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

  async function actAs(client: SupabaseClient): Promise<void> {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    vi.mocked(createServerSupabase).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof createServerSupabase>>,
    );
  }

  async function createUser(email: string): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
    return data.user.id;
  }

  beforeAll(async () => {
    platformAdminId = await createUser(adminEmail);
    await admin.from("platform_admins").insert({ user_id: platformAdminId });
    outsiderId = await createUser(outsiderEmail);
    victimId = await createUser(victimEmail);

    asPlatformAdmin = await signInAs(adminEmail);
    asOutsider = await signInAs(outsiderEmail);
  });

  afterAll(async () => {
    await admin.from("memberships").delete().eq("user_id", victimId);
    await admin.from("audit_log").delete().eq("actor_user_id", platformAdminId);
    await admin.from("platform_admins").delete().eq("user_id", platformAdminId);
    for (const id of [platformAdminId, outsiderId, victimId]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
  });

  it("từ chối người không phải platform admin", async () => {
    await actAs(asOutsider);
    await expect(
      resetTempPasswordForUser(victimId, "Ticket #418"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      grantOwnerMembership(COMPANY_ID, victimId, "Ticket #418"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("bắt buộc lý do cho cả hai đường", async () => {
    await actAs(asPlatformAdmin);
    await expect(resetTempPasswordForUser(victimId, "  ")).rejects.toThrow(
      "Vui lòng nhập lý do.",
    );
    await expect(
      grantOwnerMembership(COMPANY_ID, victimId, ""),
    ).rejects.toThrow("Vui lòng nhập lý do.");
  });

  it("cấp lại mật khẩu tạm: bật cờ must_change_password và ghi audit KHÔNG chứa mật khẩu", async () => {
    await actAs(asPlatformAdmin);
    const result = await resetTempPasswordForUser(victimId, "Ticket #418");

    expect(result.email).toBe(victimEmail);
    expect(result.temporaryPassword.length).toBeGreaterThan(20);

    const { data: user } = await admin.auth.admin.getUserById(victimId);
    expect(user.user?.app_metadata?.must_change_password).toBe(true);

    const { data: audit } = await admin
      .from("audit_log")
      .select("action, company_id, entity_table, entity_id, after, reason")
      .eq("actor_user_id", platformAdminId)
      .eq("entity_table", "auth.users");
    expect(audit ?? []).toHaveLength(1);
    const row = (audit ?? [])[0];
    expect(row.company_id).toBeNull();
    expect(row.entity_id).toBe(victimId);
    expect(row.reason).toContain("Ticket #418");

    // Khang dinh quan trong nhat cua ca file: mat khau tam KHONG BAO GIO
    // xuong audit_log.
    expect(JSON.stringify(row)).not.toContain(result.temporaryPassword);
  });

  it("mật khẩu mới dùng đăng nhập được — thao tác có hiệu lực thật, không chỉ ghi vết", async () => {
    await actAs(asPlatformAdmin);
    const result = await resetTempPasswordForUser(victimId, "Ticket #419");

    const client = createClient(url!, publishableKey!, {
      auth: { persistSession: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: victimEmail,
      password: result.temporaryPassword,
    });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
  });

  it("cấp quyền chủ doanh nghiệp: upsert membership owner + audit ở tầng nền tảng", async () => {
    await actAs(asPlatformAdmin);
    await grantOwnerMembership(COMPANY_ID, victimId, "Khách mất quyền owner");

    const { data: memberships } = await admin
      .from("memberships")
      .select("company_id, role, status")
      .eq("user_id", victimId);
    expect(memberships ?? []).toHaveLength(1);
    expect((memberships ?? [])[0]).toMatchObject({
      company_id: COMPANY_ID,
      role: "owner",
      status: "active",
    });

    const { data: audit } = await admin
      .from("audit_log")
      .select("company_id, entity_table, reason")
      .eq("actor_user_id", platformAdminId)
      .eq("entity_table", "memberships");
    expect(audit ?? []).toHaveLength(1);
    expect((audit ?? [])[0].company_id).toBeNull();
    // Ma doanh nghiep nam trong `reason` vi cot `company_id` phai NULL de dong
    // audit di qua duoc policy tang nen tang.
    expect((audit ?? [])[0].reason).toContain(COMPANY_ID);
  });

  it("gọi lại lần hai không nhân đôi membership — upsert, không insert", async () => {
    await actAs(asPlatformAdmin);
    await grantOwnerMembership(COMPANY_ID, victimId, "Lần hai");

    const { data: memberships } = await admin
      .from("memberships")
      .select("id")
      .eq("user_id", victimId);
    expect(memberships ?? []).toHaveLength(1);
  });
});
