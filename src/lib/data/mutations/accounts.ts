"use server";

import { randomBytes } from "node:crypto";

import { getSessionContext, requireRole } from "@/lib/auth/session-context";
import { CHANGE_PASSWORD_LABELS } from "@/lib/constants";
import { logMutation } from "@/lib/data/audit";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { employeeRowSchema } from "@/lib/validation/api/employees";

/**
 * Server Actions vong doi tai khoan nhan vien (plan 02-10):
 * - `createEmployeeAccount` — quan tri tao tai khoan dang nhap + mat khau tam
 *   cho mot nhan vien chua co tai khoan.
 * - `completeForcedPasswordChange` — nguoi dung tu hoan tat doi mat khau bat
 *   buoc lan dau (D-16/D-16a).
 *
 * Khuon giong `mutations/employees.ts`: `getSessionContext()` -> kiem quyen
 * -> doc/ghi voi `company_id` tu session -> `logMutation` NGAY TRONG cung
 * ham (D-17). Khac biet: buoc tao nguoi dung dang nhap phai di qua
 * `createAdminSupabase()` (Admin API, bo qua RLS) vi client cookie-bound
 * khong co quyen goi `auth.admin.*`.
 */

export interface CreateEmployeeAccountResult {
  email: string;
  temporaryPassword: string;
}

/**
 * Danh sach khoa nhay cam TUYET DOI khong duoc xuat hien trong bat ky anh
 * chup audit nao — kiem tra bang mot assertion chay that (khong phai gia
 * dinh) truoc khi ghi `audit_log`, dung theo yeu cau cua chinh <action> cua
 * Task 1 (02-10-PLAN.md).
 */
const FORBIDDEN_AUDIT_KEY_NEEDLES = ["password", "secret", "token"];

function assertNoSensitiveAuditKeys(row: Record<string, unknown>): void {
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_AUDIT_KEY_NEEDLES.some((needle) => lower.includes(needle))) {
      throw new Error(
        `Ảnh chụp audit chứa trường có thể nhạy cảm, đã chặn ghi: ${key}`,
      );
    }
  }
}

function generateTemporaryPassword(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Tao tai khoan dang nhap cho MOT nhan vien chua co tai khoan. Tra ve email
 * va mat khau tam — day la LAN DUY NHAT mat khau tam roi khoi ham nay, khong
 * bao gio ghi xuong audit_log, cot nao cua `employees`, hay log server.
 */
export async function createEmployeeAccount(
  employeeId: string,
): Promise<CreateEmployeeAccountResult> {
  const { companyId, userId, role } = await getSessionContext();
  requireRole(role, ["owner", "admin"]);

  const supabase = await createServerSupabase();

  // Doc nguyen dong TRUOC (co user_id) bang client cookie-bound — RLS van la
  // lop phong thu thu hai, ranh gioi doanh nghiep den tu `.eq("company_id")`.
  const { data: beforeRow, error: beforeError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (beforeError || !beforeRow) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const beforeRecord = beforeRow as Record<string, unknown>;
  if (beforeRecord.user_id) {
    throw new Error("Nhân viên này đã có tài khoản đăng nhập.");
  }

  const employee = employeeRowSchema.parse(beforeRow);
  const temporaryPassword = generateTemporaryPassword();

  // Tu day tro di dung khoa bi mat -- moi kiem quyen (requireRole) va kiem
  // ranh gioi doanh nghiep (.eq("company_id") o tren) da xong TRUOC khi cham
  // toi Admin API, dung khuon "tu kiem quyen truoc" cua src/lib/supabase/admin.ts.
  const admin = createAdminSupabase();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: employee.email,
    password: temporaryPassword,
    email_confirm: true, // D-14a: khong thi tai khoan ket o cho xac nhan email.
    app_metadata: { must_change_password: true }, // D-16: nhanh server, client khong sua duoc.
  });

  if (createError || !created?.user) {
    throw new Error("Không thể tạo tài khoản đăng nhập cho nhân viên này.");
  }

  const newUserId = created.user.id;

  // Chen membership bang client cookie-bound (KHONG phai khoa bi mat) — RLS
  // `memberships_insert_member` chi doi hoi CHINH NGUOI GOI (actor) la thanh
  // vien active cua company_id, khong doi hoi user_id duoc chen phai trung
  // actor, nen thao tac "tao ho" nay van qua duoc RLS nhu mot lop kiem thu hai.
  const { error: membershipError } = await supabase.from("memberships").insert({
    user_id: newUserId,
    company_id: companyId,
    role: employee.systemRole,
    status: "active",
    last_accessed_at: null,
  });

  if (membershipError) {
    throw new Error("Không thể gán quyền truy cập cho tài khoản vừa tạo.");
  }

  /**
   * `pending_invite` nghia la "CHUA co tai khoan de dang nhap" — nhan hien ra
   * man hinh la "Chưa kích hoạt tài khoản". Ngay dong nay chay xong thi dieu
   * do khong con dung nua, nen trang thai phai di theo trong CUNG mot lan ghi:
   * tach lam hai lan ghi se de lai mot khoang thoi gian ma ho so vua co tai
   * khoan vua bao chua kich hoat.
   *
   * CHI doi tu `pending_invite`. `on_leave` va `terminated` la nhung su that
   * NGHIEP VU doc lap voi viec co tai khoan hay khong — dat het ve `active` o
   * day la dung mot su that de sua mot nhan hien thi, va lam bien mat viec
   * nguoi do dang nghi hoac da nghi viec.
   */
  const nextStatus =
    employee.status === "pending_invite" ? { status: "active" as const } : {};

  const { data: afterRow, error: updateError } = await supabase
    .from("employees")
    .update({ user_id: newUserId, ...nextStatus })
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (updateError || !afterRow) {
    throw new Error("Không thể liên kết tài khoản với hồ sơ nhân viên.");
  }

  const afterRecord = afterRow as Record<string, unknown>;
  // Assertion chay that (khong phai gia dinh): bang `employees` khong co cot
  // mat khau, nhung van quet ca hai anh chup truoc khi ghi audit.
  assertNoSensitiveAuditKeys(beforeRecord);
  assertNoSensitiveAuditKeys(afterRecord);

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "employees",
    entityId: employeeId,
    before: beforeRow,
    after: afterRow,
    reason: null,
  });

  return { email: employee.email, temporaryPassword };
}

const MIN_PASSWORD_LENGTH = 8;
const REFRESH_RETRY_DELAY_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Nhan dien loi "refresh token da bi xoay/da dung" — du an bat token rotation
 * (xem 02-RESEARCH.md §Pitfall 3), nen hai lenh refresh gan nhau co the tranh
 * nhau CUNG mot refresh token. Kiem ca `code` (khi Supabase JS tra ve dang co
 * cau truc) lan chuoi thong diep (phong khi phien ban SDK khac nhau tra ve
 * hinh dang loi khac nhau).
 */
function isRefreshTokenConflict(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "refresh_token_already_used") return true;
  return /refresh.?token/i.test(error.message ?? "") &&
    /already|used|invalid|expired/i.test(error.message ?? "");
}

/**
 * Hoan tat doi mat khau bat buoc lan dau. Trinh tu BAT BUOC dung THU TU nay
 * (D-16a) — dao hai buoc cuoi (xoa co / lam moi phien) la tao ra vong lap
 * chuyen huong ma nguoi dung khong thoat ra duoc, vi `app_metadata` chi vao
 * JWT SAU khi refresh:
 *   1. Doi mat khau tren client cookie-bound cua CHINH nguoi dung.
 *   2. Xoa co `must_change_password` qua khoa bi mat (client cookie-bound
 *      khong co quyen sua metadata cua chinh no).
 *   3. NGAY TRONG CUNG REQUEST, ep `refreshSession()` tren client cookie-bound
 *      de access token moi (da sach co) duoc ghi len cookie cua response nay
 *      — khong dua vao middleware cua request ke tiep lam ho.
 *
 * Hai loai loi TUYET DOI khong duoc gop chung (T-02-10-07, prohibition cua
 * 02-10-PLAN.md): mat khau CHUA doi duoc (an toan de thu lai) vs mat khau DA
 * doi thanh cong nhung phien khong lam moi duoc (PHAI dang nhap lai, khong
 * duoc thu lai bang mat khau cu).
 */
export async function completeForcedPasswordChange(newPassword: string): Promise<void> {
  const { userId, companyId, mustChangePassword } = await getSessionContext();

  if (!mustChangePassword) {
    // Chan dung nhu mot duong doi mat khau chung chua duoc thiet ke
    // (T-02-10-08) — endpoint nay CHI phuc vu luong buoc doi lan dau.
    throw new Error(CHANGE_PASSWORD_LABELS.notForcedError);
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    // Kiem tra lai o tang server (defense-in-depth) — form da kiem qua
    // `changePasswordSchema`, nhung Server Action khong duoc tin tuong mu
    // quang tham so tu client (D-12b tinh than tuong tu, ap dung cho input).
    throw new Error(CHANGE_PASSWORD_LABELS.notChangedErrorFallback);
  }

  const supabase = await createServerSupabase();

  // Buoc 1: doi mat khau tren CHINH client cookie-bound cua nguoi dang dang
  // nhap -- Supabase tu doi chieu voi phien hien hanh, khong can truyen id.
  const { error: updatePasswordError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updatePasswordError) {
    throw new Error(CHANGE_PASSWORD_LABELS.notChangedErrorFallback);
  }

  // Buoc 2: xoa co tren nhanh app_metadata PHIA SERVER (D-16) -- BAT BUOC
  // dung khoa bi mat, client cookie-bound khong co quyen sua metadata nay.
  const admin = createAdminSupabase();
  const { error: clearFlagError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { must_change_password: false },
  });
  if (clearFlagError) {
    // Mat khau O BUOC 1 da doi thanh cong -- day van la loai loi "da doi
    // nhung phai dang nhap lai", KHONG phai loai "chua doi duoc".
    throw new Error(CHANGE_PASSWORD_LABELS.changedButSessionStaleError);
  }

  // Buoc 3 (D-16a): ep refresh NGAY trong cung request. Neu gap tranh chap
  // xoay refresh token, thu lai DUNG MOT LAN sau mot khoang cho ngan.
  let refreshError = (await supabase.auth.refreshSession()).error;
  if (refreshError && isRefreshTokenConflict(refreshError)) {
    await delay(REFRESH_RETRY_DELAY_MS);
    refreshError = (await supabase.auth.refreshSession()).error;
  }
  if (refreshError) {
    throw new Error(CHANGE_PASSWORD_LABELS.changedButSessionStaleError);
  }

  // `before`/`after` o day KHONG phai nguyen dong (ngoai le co chu dich cua
  // D-18): bang nguoi dung cua Supabase khong thuoc quyen doc nguyen dong
  // cua tang ung dung, va ghi nguyen dong nghia la sao chep bam mat khau vao
  // audit_log -- vi pham chinh dieu D-17a/prohibition cua plan nay dang bao
  // ve. Chi ghi dung mot truong da doi.
  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "auth.users",
    entityId: userId,
    before: { must_change_password: true },
    after: { must_change_password: false },
    reason: null,
  });
}
