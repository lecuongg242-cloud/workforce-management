import type { Metadata } from "next";

import { DashboardView } from "@/app/admin/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Tổng quan",
};

export default function DashboardPage(): React.ReactElement {
  return <DashboardView />;
}
