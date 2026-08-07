"use server";

import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import {
  ACTIVE_COMPANY_COOKIE,
  ForbiddenError,
  getAuthenticatedUser,
  getSessionContext,
} from "@/lib/auth/session-context";
import { logMutation } from "@/lib/data/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Company, CompanyInput } from "@/lib/types/domain";

const ACTIVE_COMPANY_MAX_AGE = 60 * 60 * 24 * 30; // 30 ngay

/**
 * Chon doanh nghiep hien hanh. Lay MOI dinh danh tu `getSessionContext()`,
 * khong bao gio tu tham so client gui len (ngoai `companyId` von luon duoc
 * xac minh lai voi `memberships` truoc khi dung — D-12b).
 */
export async function selectCompanyAction(companyId: string): Promise<void> {
  const { userId } = await getSessionContext();
  const supabase = await createServerSupabase();

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id, user_id, company_id, role, status, last_accessed_at")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !membership) {
    // companyId khong thuoc membership active nao cua nguoi nay -- tu choi,
    // KHONG dat cookie.
    throw new ForbiddenError();
  }

  const before = { ...membership };
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("memberships")
    .update({ last_accessed_at: now })
    .eq("id", membership.id)
    .select("id, user_id, company_id, role, status, last_accessed_at")
    .single();

  if (updateError || !updated) {
    throw new Error("Không thể chọn doanh nghiệp.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_COMPANY_MAX_AGE,
  });

  await logMutation({
    companyId,
    actorUserId: userId,
    action: "update",
    entityTable: "memberships",
    entityId: membership.id,
    before,
    after: updated,
    reason: null,
  });
}

/**
 * NGOAI LE DUY NHAT trong toan bo tang du lieu ma khoa secret duoc dung ben
 * trong mot Server Action thay vi mot script chay rieng (analog voi
 * `scripts/seed-auth.mjs` cho tai khoan): tao mot doanh nghiep MOI la mot
 * vong lap "ga va trung" ma RLS cookie-bound khong the giai duoc — chinh
 * sach `companies_insert_member`/`memberships_insert_member`
 * (`supabase/migrations/0002_tenancy.sql`) doi hoi mot dong `memberships`
 * active DA TON TAI truoc khi cho phep ghi, nhung dong `memberships` do lai
 * tham chieu toi chinh `company_id` chua duoc tao. Khong co thu tu chen nao
 * bang client cookie-bound thoa man ca hai rang buoc cung luc.
 *
 * Pham vi duoc gioi han chat: chi dung sau khi `getAuthenticatedUser()` da
 * doi hoi mot phien that (khong bao gio anonymous), va ket qua membership
 * luon duoc gan CHINH XAC cho `userId` cua nguoi goi — khong co duong nao de
 * mot nguoi tu gan minh lam thanh vien mot doanh nghiep KHAC qua duong nay.
 * `logMutation()` sau do van dung client cookie-bound thong thuong (D-17)
 * vi luc do membership that da ton tai, RLS lai la lop phong thu thu hai.
 */
function createCompanyBootstrapClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Thiếu cấu hình máy chủ để tạo doanh nghiệp mới.");
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Tao doanh nghiep moi + phong ban/ca lam mac dinh (bat buoc vi
 * `employees.department_id`/`shift_id` la NOT NULL — chua co man hinh quan
 * ly phong ban/ca lam o buoc onboarding nay) + membership `owner` + ho so
 * `employees` cho chinh nguoi tao. Nhung truong ho so ca nhan chua thu thap
 * duoc o form onboarding (ngay sinh, gioi tinh, vi tri lam viec) duoc dien
 * gia tri dai dien va can duoc nguoi dung sua lai sau o man hinh nhan vien
 * (xem SUMMARY §Known Stubs).
 */
export async function createCompanyAction(
  input: CompanyInput,
): Promise<Company> {
  const { userId, email } = await getAuthenticatedUser();
  const admin = createCompanyBootstrapClient();

  const companyId = randomUUID();
  const departmentId = randomUUID();
  const shiftId = randomUUID();
  const employeeId = randomUUID();
  const today = new Date().toISOString().slice(0, 10);

  const { data: companyRow, error: companyError } = await admin
    .from("companies")
    .insert({
      id: companyId,
      name: input.name,
      code: input.code,
      industry: input.industry,
      size: input.size,
      phone: input.phone,
      address: input.address,
      accent: "indigo",
    })
    .select()
    .single();
  if (companyError || !companyRow) {
    throw new Error("Không thể tạo doanh nghiệp.");
  }

  const { error: departmentError } = await admin.from("departments").insert({
    id: departmentId,
    company_id: companyId,
    name: "Phòng ban mặc định",
    description: "Phòng ban khởi tạo tự động khi tạo doanh nghiệp.",
    manager_id: null,
    status: "active",
  });
  if (departmentError) {
    throw new Error("Không thể khởi tạo phòng ban mặc định.");
  }

  const { error: shiftError } = await admin.from("shifts").insert({
    id: shiftId,
    company_id: companyId,
    name: "Ca hành chính",
    code: "CA-HC",
    // Ca khoi tao la ca CO GIO CU THE (migration 0027). Khai `kind` tuong minh
    // thay vi dua vao gia tri mac dinh cua cot: day la mot trong hai noi ghi
    // thang vao bang `shifts` khong di qua `shiftInputSchema`, nen hinh dang
    // dong phai doc duoc ngay tai cho.
    kind: "fixed",
    start_time: "08:00",
    end_time: "17:30",
    duration_minutes: null,
    // Khung gio nghi (0025) va so phut PHAI khop nhau — day la mot trong hai
    // noi ghi thang vao bang `shifts` khong di qua `shiftInputSchema`.
    break_start_time: "12:00",
    break_end_time: "13:00",
    break_minutes: 60,
    late_tolerance_minutes: 5,
    working_days: [1, 2, 3, 4, 5],
    status: "active",
  });
  if (shiftError) {
    throw new Error("Không thể khởi tạo ca làm việc mặc định.");
  }

  // Cau hinh van hanh cua doanh nghiep moi (plan 04-01): chen dong voi TOAN BO
  // gia tri mac dinh cua migration 0015 — khong lap lai con so nao o day. Doanh
  // nghiep moi vi vay co dung mot dong cau hinh ngay tu phut dau, trong khi
  // `holidays` va `overtime_rules` van RONG (D-26): cau hinh la nguong van
  // hanh, con ngay le va he so la thu doanh nghiep phai tu khai.
  const { error: settingsError } = await admin
    .from("company_settings")
    .insert({ company_id: companyId });
  if (settingsError) {
    throw new Error("Không thể khởi tạo cấu hình doanh nghiệp.");
  }

  const nowIso = new Date().toISOString();
  const { error: membershipError } = await admin.from("memberships").insert({
    user_id: userId,
    company_id: companyId,
    role: "owner",
    status: "active",
    last_accessed_at: nowIso,
  });
  if (membershipError) {
    throw new Error("Không thể gán quyền chủ sở hữu.");
  }

  const { error: employeeError } = await admin.from("employees").insert({
    id: employeeId,
    company_id: companyId,
    code: "NV001",
    full_name: email.split("@")[0] || "Chủ sở hữu",
    email,
    phone: input.phone,
    // NGAY SINH VA GIOI TINH DE `null`, KHONG dien gia tri dai dien.
    //
    // Truoc migration 0028 hai cot nay la NOT NULL nen buoc onboarding phai
    // dien `today` va `"other"` — mot ngay sinh bang dung ngay tao doanh nghiep
    // va mot gioi tinh khong ai chon. Ca hai hien ra man hinh y het du lieu
    // that, nen nguoi dung khong co cach nao biet do la thu he thong tu bia.
    // 0028 bo rang buoc do; day la cho tra mon no ay (SUMMARY §Known Stubs).
    date_of_birth: null,
    gender: null,
    department_id: departmentId,
    position: null,
    contract_type: null,
    start_date: today,
    shift_id: shiftId,
    work_location: input.address,
    status: "active",
    system_role: "owner",
    invitation_sent: false,
    can_view_payslip: true,
    can_check_in_remotely: true,
    user_id: userId,
  });
  if (employeeError) {
    throw new Error("Không thể tạo hồ sơ nhân viên cho chủ sở hữu.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_COMPANY_MAX_AGE,
  });

  // Tu day tro di membership that da ton tai nen RLS cookie-bound lai hoat
  // dong binh thuong -- audit van ghi qua duong thong thuong (D-17).
  await logMutation({
    companyId,
    actorUserId: userId,
    action: "insert",
    entityTable: "companies",
    entityId: companyId,
    before: null,
    after: companyRow,
    reason: null,
  });

  return {
    id: companyRow.id,
    name: companyRow.name,
    code: companyRow.code,
    industry: companyRow.industry,
    size: companyRow.size,
    phone: companyRow.phone,
    address: companyRow.address,
    role: "owner",
    employeeCount: 1,
    lastAccessedAt: nowIso,
    accent: companyRow.accent,
  };
}

/** Ten xuat trung `mock/service.ts` -- call site chi doi dong import. */
export async function createCompany(input: CompanyInput): Promise<Company> {
  return createCompanyAction(input);
}
