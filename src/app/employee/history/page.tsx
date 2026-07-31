import type { Metadata } from "next";

import { HistoryView } from "@/app/employee/history/history-view";

export const metadata: Metadata = {
  title: "Lịch sử chấm công",
};

export default function EmployeeHistoryPage(): React.ReactElement {
  return <HistoryView />;
}
