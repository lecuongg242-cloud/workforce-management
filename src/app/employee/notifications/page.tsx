import type { Metadata } from "next";

import { NotificationsView } from "@/app/employee/notifications/notifications-view";

export const metadata: Metadata = {
  title: "Thông báo",
};

export default function EmployeeNotificationsPage(): React.ReactElement {
  return <NotificationsView />;
}
