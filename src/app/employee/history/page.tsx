import type { Metadata } from "next";

import { HistoryView } from "@/app/employee/history/history-view";
import { getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Lịch sử chấm công",
};

export default async function EmployeeHistoryPage(): Promise<React.ReactElement> {
  // Truyen CA NGAY chu khong chi thang: man hinh can phan biet "đang làm
  // việc" (hom nay, chua cham ra) voi "thiếu giờ ra" (ngay da qua).
  const today = await getServerToday();
  return <HistoryView month={today.slice(0, 7)} today={today} />;
}
