import type { Metadata } from "next";

import { HistoryView } from "@/app/employee/history/history-view";
import { getServerMonth } from "@/lib/today";

export const metadata: Metadata = {
  title: "Lịch sử chấm công",
};

export default async function EmployeeHistoryPage(): Promise<React.ReactElement> {
  const month = await getServerMonth();
  return <HistoryView month={month} />;
}
