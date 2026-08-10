// @vitest-environment node
//
// Test TICH HOP tren Postgres dev THAT cho RPC `tf_platform_company_overview()`
// (SADM-01, D-56). Chay bang phien dang nhap THAT — dieu duy nhat ham nay dua
// vao la `tf_is_platform_admin()`, ma ham do suy tu `auth.uid()`, nen mot
// client khoa service se lam moi khang dinh o day thanh vo nghia.
import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { platformCompanyRowSchema } from "@/lib/validation/api/platform";

describe("tf_platform_company_overview (SADM-01)", () => {
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

  const password = `Overview!${randomBytes(8).toString("hex")}`;
  const adminEmail = `pa-${randomBytes(5).toString("hex")}@timeflow.test`;
  const outsiderEmail = `out-${randomBytes(5).toString("hex")}@timeflow.test`;

  let platformAdminId = "";
  let outsiderId = "";
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

  beforeAll(async () => {
    const { data: a, error: aError } = await admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
    });
    if (aError || !a.user) throw new Error(`createUser: ${aError?.message}`);
    platformAdminId = a.user.id;
    await admin.from("platform_admins").insert({ user_id: platformAdminId });

    const { data: b, error: bError } = await admin.auth.admin.createUser({
      email: outsiderEmail,
      password,
      email_confirm: true,
    });
    if (bError || !b.user) throw new Error(`createUser: ${bError?.message}`);
    outsiderId = b.user.id;

    asPlatformAdmin = await signInAs(adminEmail);
    asOutsider = await signInAs(outsiderEmail);
  });

  afterAll(async () => {
    await admin.from("platform_admins").delete().eq("user_id", platformAdminId);
    if (platformAdminId) await admin.auth.admin.deleteUser(platformAdminId);
    if (outsiderId) await admin.auth.admin.deleteUser(outsiderId);
  });

  it("platform admin thấy mọi doanh nghiệp kèm số tổng hợp", async () => {
    const { data, error } = await asPlatformAdmin.rpc(
      "tf_platform_company_overview",
    );
    expect(error).toBeNull();

    const rows = (data ?? []) as unknown[];
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const parsed = rows.map((row) => platformCompanyRowSchema.parse(row));
    const ngocPhat = parsed.find((row) => row.id === "cty-01");
    expect(ngocPhat).toBeDefined();
    expect(ngocPhat?.employeeCount).toBeGreaterThan(0);

    // Ca hai doanh nghiep seed deu co mat — day la khac biet giua "nhin toan
    // he thong" va "nhin doanh nghiep cua minh".
    expect(parsed.map((row) => row.id)).toContain("cty-02");
  });

  it("người thường KHÔNG thấy dòng nào — điều kiện nằm ở mệnh đề where của hàm", async () => {
    const { data, error } = await asOutsider.rpc("tf_platform_company_overview");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("hàm chỉ trả SỐ TỔNG HỢP, không trả một dòng dữ liệu nghiệp vụ nào", async () => {
    // Khang dinh nay la ly do ham duoc phep nhin xuyen doanh nghiep MA KHONG
    // CAN mot phien ho tro (D-56). Neu ai do them mot cot ten nhan vien hay
    // mot con so tien vao day, no phai do o cho nay truoc.
    const { data } = await asPlatformAdmin.rpc("tf_platform_company_overview");
    const columns = Object.keys(((data ?? []) as Record<string, unknown>[])[0] ?? {});
    expect(columns.sort()).toEqual(
      [
        "company_code",
        "company_id",
        "company_name",
        "employee_count",
        "last_activity_at",
        "open_period_start",
      ].sort(),
    );
  });
});
