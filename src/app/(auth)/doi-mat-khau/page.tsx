import type { Metadata } from "next";

import { ChangePasswordForm } from "@/app/(auth)/doi-mat-khau/change-password-form";
import { AppLogo } from "@/components/brand/app-logo";
import { CHANGE_PASSWORD_LABELS } from "@/lib/constants";

/**
 * Trang doi mat khau bat buoc lan dau (D-16). `middleware.ts` la noi CHAN
 * duong dan nay — trang chi RENDER bieu mau, khong tu kiem lai co bat buoc,
 * de tranh mot noi thu hai co the lech logic voi cong o middleware.
 */
export const metadata: Metadata = {
  title: CHANGE_PASSWORD_LABELS.pageTitle,
};

export default function ChangePasswordPage(): React.ReactElement {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas-soft px-5 py-10">
      <div className="surface-card w-full max-w-md p-6 sm:p-8">
        <AppLogo size="md" className="mb-6" />
        <h1 className="display-md text-ink">{CHANGE_PASSWORD_LABELS.heading}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{CHANGE_PASSWORD_LABELS.description}</p>

        <div className="mt-6">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
