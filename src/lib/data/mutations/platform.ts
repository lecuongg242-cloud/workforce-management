"use server";

import { randomBytes } from "node:crypto";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { logMutation } from "@/lib/data/audit";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Hai duong ghi DUY NHAT cua super admin (SADM-04, D-56).
 *
 * Ca hai deu nam NGOAI du lieu cham cong va luong: doi van hanh khong sua
 * duoc mot ban ghi cong hay mot con so tien nao, o bat ky duong nao. Do la
 * loi hua loi cua san pham ("doanh nghiep tin duoc so lieu cham cong") va
 * phase nay khong duoc phep dung vao.
 *
 * Ca hai di qua Admin API (`createAdminSupabase()`, bo qua RLS) chu KHONG qua
 * phien ho tro — phien ho tro chi mo lenh SELECT (D-50). Vi client nay bo qua
 * RLS, moi ham o day tu kiem quyen bang `requirePlatformAdmin()` TRUOC khi
 * cham du lieu; database se KHONG kiem ho.
 *
 * Ca hai bat buoc `reason`, va moi lan de lai mot dong `audit_log` mang
 * `company_id = NULL` (thao tac tang nen tang — policy `audit_log_insert_platform`,
 * migration 0036).
 */

const TEMP_PASSWORD_BYTES = 18;

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length === 0) throw new Error("Vui lòng nhập lý do.");
  return trimmed;
}

export interface ResetTempPasswordResult {
  email: string;
  temporaryPassword: string;
}

/**
 * Tim `user_id` theo email.
 *
 * Ton tai vi thu doi van hanh CO trong tay khi khach goi den la mot dia chi
 * email, khong phai mot uuid. Hai ham ghi ben duoi van nhan `userId` — chung
 * la thao tac nguy hiem va nen nhan mot dinh danh khong the go nham.
 *
 * Admin API khong co endpoint "tim theo email", nen phai quet `listUsers`
 * theo trang — cung khuon `findUserIdByEmail()` cua `scripts/seed-auth.mjs`.
 */
export async function findPlatformUserIdByEmail(
  email: string,
): Promise<string | null> {
  await requirePlatformAdmin();

  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) return null;

  const admin = createAdminSupabase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error("Không tra cứu được tài khoản.");
    const users = data?.users ?? [];
    const hit = users.find((user) => user.email?.toLowerCase() === normalized);
    if (hit) return hit.id;
    if (users.length < 200) return null;
  }
  return null;
}

/**
 * Cap lai mat khau tam cho mot tai khoan bat ky va bat co buoc doi lan dau
 * (D-16).
 *
 * Mat khau tam roi khoi ham nay DUNG MOT LAN qua gia tri tra ve — khong bao
 * gio xuong `audit_log`, khong bao gio xuong log server, khong bao gio ghi
 * vao mot cot nao. Cung rang buoc voi `createEmployeeAccount()` (02-10).
 */
export async function resetTempPasswordForUser(
  userId: string,
  reason: string,
): Promise<ResetTempPasswordResult> {
  const { userId: actorUserId } = await requirePlatformAdmin();
  const trimmedReason = requireReason(reason);

  const admin = createAdminSupabase();
  const temporaryPassword = randomBytes(TEMP_PASSWORD_BYTES).toString(
    "base64url",
  );

  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    app_metadata: { must_change_password: true },
  });

  if (error || !data.user) {
    throw new Error("Không cấp lại được mật khẩu tạm cho tài khoản này.");
  }

  await logMutation({
    companyId: null,
    actorUserId,
    action: "update",
    entityTable: "auth.users",
    entityId: userId,
    before: null,
    // Anh chup CHI mang co, tuyet doi khong mang mat khau.
    after: { must_change_password: true },
    reason: `Super admin cấp lại mật khẩu tạm: ${trimmedReason}`,
  });

  return { email: data.user.email ?? "", temporaryPassword };
}

/**
 * Cap lai membership `owner` khi khach mat duong vao chinh doanh nghiep minh.
 *
 * `upsert` chu khong `insert`: truong hop hay gap nhat khong phai "chua tung
 * co membership" ma la "dong membership VAN CON nhung `status` da thanh
 * 'inactive'".
 */
export async function grantOwnerMembership(
  companyId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const { userId: actorUserId } = await requirePlatformAdmin();
  const trimmedReason = requireReason(reason);

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("memberships")
    .upsert(
      {
        company_id: companyId,
        user_id: userId,
        role: "owner",
        status: "active",
      },
      { onConflict: "user_id,company_id" },
    );

  if (error) {
    throw new Error("Không cấp lại được quyền chủ doanh nghiệp.");
  }

  await logMutation({
    // Thao tac nay CO doanh nghiep — khac `resetTempPasswordForUser`. Nhung
    // dong audit van phai di qua policy nen tang: platform admin khong la
    // thanh vien cua `companyId` va khong nhat thiet dang co phien ho tro o
    // do, nen ca hai policy insert kia deu khong cho qua. Vi vay ghi
    // `company_id = NULL` va dat ma doanh nghiep vao `reason` — mot dong vet
    // ghi duoc con hon mot dong vet dung cot nhung khong bao gio ghi duoc.
    companyId: null,
    actorUserId,
    action: "update",
    entityTable: "memberships",
    entityId: userId,
    before: null,
    after: { company_id: companyId, role: "owner", status: "active" },
    reason: `Super admin cấp quyền chủ doanh nghiệp ${companyId}: ${trimmedReason}`,
  });
}
