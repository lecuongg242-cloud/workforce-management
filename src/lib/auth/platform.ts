import {
  ForbiddenError,
  getAuthenticatedUser,
} from "@/lib/auth/session-context";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Diem chan danh tinh cua khu `/platform` va cua moi duong ghi rieng cua
 * super admin.
 *
 * KHONG dung `getSessionContext()`: ham do doi mot membership active, ma
 * platform admin theo dung dinh nghia (0006_platform_admins.sql) khong thuoc
 * doanh nghiep nao — goi no o day se luon nem `NoMembershipError`.
 *
 * Cau tra loi "toi co phai platform admin khong" LUON di qua RPC
 * `tf_is_platform_admin()`: bang `platform_admins` bat RLS chan doc truc tiep
 * (D-11a) nen khong co duong nao khac, va do la co y — mot cho hoi duy nhat
 * thi chi co mot cho de sai.
 */
export async function requirePlatformAdmin(): Promise<{
  userId: string;
  email: string;
}> {
  const user = await getAuthenticatedUser();

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("tf_is_platform_admin");
  if (error || data !== true) {
    throw new ForbiddenError();
  }

  return user;
}

/**
 * Bien the khong nem — dung o nhung noi chi can RE NHANH giao dien (vi du
 * `/select-company` co hien lien ket sang khu van hanh hay khong), khong phai
 * noi quyet dinh cho hay chan truy cap.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  try {
    await requirePlatformAdmin();
    return true;
  } catch {
    return false;
  }
}
