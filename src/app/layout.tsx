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

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Quản lý chấm công và nhân sự`,
    template: `%s · ${APP_NAME}`,
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
