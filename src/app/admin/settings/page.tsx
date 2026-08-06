import type { Metadata } from "next";

import { SettingsView } from "@/app/admin/settings/settings-view";
import { getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Cài đặt",
};

/**
 * "Hom nay" do SERVER cap (D-19) roi truyen xuong lam prop — tab Ngay le dung
 * no de biet ngay nao thuoc qua khu. Khong client component nao duoc tu tinh
 * lai gia tri nay.
 */
export default async function SettingsPage(): Promise<React.ReactElement> {
  const today = await getServerToday();
  return <SettingsView today={today} />;
}
