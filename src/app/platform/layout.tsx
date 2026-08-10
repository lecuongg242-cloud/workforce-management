import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { SUPPORT_LABELS } from "@/lib/constants";

/**
 * Khu van hanh TimeFlow. KHONG dung `AdminShell`: khu nay khong thuoc mot
 * doanh nghiep nao, nen sidebar quan tri (von lay ten doanh nghiep hien hanh
 * lam dau trang) khong co gi de hien.
 *
 * Chan bang `requirePlatformAdmin()` chu khong bang `getSessionContextOrNull()`
 * + kiem vai tro: platform admin theo dinh nghia khong co membership nao, nen
 * `getSessionContext()` se nem `NoMembershipError` truoc khi kip hoi ai la ai.
 *
 * `middleware.ts` da chan khach chua dang nhap truoc khi toi day (AUTH-02).
 * Redirect ve `/` cho moi truong hop con lai: nguoi da dang nhap nhung khong
 * phai platform admin khong duoc biet khu nay ton tai.
 */
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/");
  }

  return (
    <div className="min-h-dvh bg-canvas-soft">
      <header className="border-b border-hairline bg-brand-dark text-white">
        <div className="mx-auto flex h-topbar w-full max-w-6xl items-center gap-6 px-4 lg:px-8">
          <span className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            {SUPPORT_LABELS.platformArea}
          </span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/platform" className="hover:underline">
              {SUPPORT_LABELS.companies}
            </Link>
            <Link href="/platform/log" className="hover:underline">
              {SUPPORT_LABELS.log}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
