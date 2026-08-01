import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/layout/admin-shell";
import { getSessionContextOrNull } from "@/lib/auth/session-context";

export const metadata: Metadata = {
  title: "Quản trị",
};

/**
 * `middleware.ts` da bat khach chua dang nhap truoc khi toi day (AUTH-02).
 * Con lai mot truong hop middleware KHONG the biet: nguoi da dang nhap
 * nhung chua co doanh nghiep hien hanh xac dinh duoc (0 hoac >=2 membership
 * active ma chua chon) — `getSessionContextOrNull()` tra `null` cho ca hai,
 * va o day (chu KHONG phai o `src/app/layout.tsx` goc) la noi dung de
 * redirect, de `/login` va `/select-company` khong tu da chinh minh.
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
  return <AdminShell>{children}</AdminShell>;
}
