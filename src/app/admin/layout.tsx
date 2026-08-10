import { redirect } from "next/navigation";

import { AdminShell } from "@/components/layout/admin-shell";
import {
  canAccessAdminArea,
  getActiveSupportSession,
  getSessionContextOrNull,
} from "@/lib/auth/session-context";

// KHONG khai bao `metadata.title` o day: mot title dang chuoi o tang layout se
// XOA `template` ma `src/app/layout.tsx` dat cho ca cay con, khien moi trang
// trong `/admin/*` thoat khoi quy tac "tab luon la APP_NAME".

/**
 * `middleware.ts` da bat khach chua dang nhap truoc khi toi day (AUTH-02).
 * Con lai mot truong hop middleware KHONG the biet: nguoi da dang nhap
 * nhung chua co doanh nghiep hien hanh xac dinh duoc (0 hoac >=2 membership
 * active ma chua chon) — `getSessionContextOrNull()` tra `null` cho ca hai,
 * va o day (chu KHONG phai o `src/app/layout.tsx` goc) la noi dung de
 * redirect, de `/login` va `/select-company` khong tu da chinh minh.
 *
 * Chan theo vai tro cung nam o day chu khong o middleware: vai tro den tu
 * bang `memberships` (AUTH-03), middleware chi co JWT nen khong biet duoc.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const context = await getSessionContextOrNull();
  if (!context) {
    redirect("/select-company");
  }
  if (!canAccessAdminArea(context.role)) {
    redirect("/employee");
  }

  // Han cua phien ho tro doc o TANG SERVER roi truyen xuong (D-54). Banner la
  // Client Component nen tu no khong hoi database duoc, va cho no goi mot
  // Route Handler rieng chi de lay mot dau thoi gian la thua mot vong mang o
  // moi lan dieu huong trong khu quan tri.
  const supportExpiresAt =
    context.role === "support"
      ? ((await getActiveSupportSession())?.expiresAt ?? null)
      : null;

  return (
    <AdminShell supportExpiresAt={supportExpiresAt}>{children}</AdminShell>
  );
}
