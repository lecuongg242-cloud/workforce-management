import type { Metadata } from "next";

import { DashboardView } from "@/app/admin/dashboard/dashboard-view";
import { getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Tổng quan",
};

export default async function DashboardPage(): Promise<React.ReactElement> {
  const today = await getServerToday();
  return <DashboardView today={today} />;
}
