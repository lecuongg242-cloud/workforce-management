import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { SelectCompanyView } from "@/app/(auth)/select-company/select-company-view";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { SUPPORT_LABELS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Chọn doanh nghiệp",
};

export default async function SelectCompanyPage(): Promise<React.ReactElement> {
  // Platform admin theo dinh nghia khong thuoc doanh nghiep nao, nen ho luon
  // roi vao trang nay va thay mot danh sach RONG sau khi dang nhap. Khong co
  // lien ket nay thi duong duy nhat toi khu van hanh la go tay dia chi.
  //
  // Kiem o tang SERVER: `SelectCompanyView` la Client Component va `session`
  // cua no la `null` voi platform admin (getClientSession tra null khi khong
  // co membership lan phien ho tro), nen no khong tu biet duoc.
  const canSeePlatformArea = await isPlatformAdmin();

  return (
    <div className="min-h-dvh bg-canvas-soft">
      <SelectCompanyView />
      {canSeePlatformArea ? (
        <div className="mx-auto w-full max-w-5xl px-5 pb-10 sm:px-8">
          <Link
            href="/platform"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {SUPPORT_LABELS.platformArea}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
