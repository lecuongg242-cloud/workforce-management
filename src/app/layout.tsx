import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AppProviders } from "@/app/providers";
import { getClientSession } from "@/lib/auth/session-context";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Tab trinh duyet LUON hien dung `APP_NAME`, khong doi theo trang.
 *
 * `template` CO CHU DICH khong chua `%s`: Next.js thay `%s` bang title cua
 * trang con roi mo i tra ve chuoi ket qua — khong co `%s` thi moi trang con
 * deu ra dung `APP_NAME`. Day la cach duy nhat khoa duoc tieu de tu tang goc;
 * `absolute` khong lam duoc vi trang con van ghi de len no.
 *
 * He qua: cac khai bao `metadata.title` o tung `page.tsx` van con nhung KHONG
 * con hien ra tab nua. Chung duoc giu lai de bat lai tieu de theo trang chi
 * bang mot dong (doi `template` ve `%s · ${APP_NAME}`).
 */
export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: APP_NAME,
  },
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Server Component: dung phien mot lan roi truyen xuong lam prop, khong
  // component client nao duoc tu doc lai kho luu tru trinh duyet nua.
  const initialSession = await getClientSession();

  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-dvh antialiased">
        <AppProviders initialSession={initialSession}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
