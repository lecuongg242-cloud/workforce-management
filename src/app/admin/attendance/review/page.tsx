import type { Metadata } from "next";

import { AttendanceReviewView } from "@/app/admin/attendance/review/attendance-review-view";
import { getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Cần xem lại",
};

export default async function AttendanceReviewPage(): Promise<React.ReactElement> {
  // "Hom nay" do SERVER cap (D-19) — cac moc "7 ngay qua", "30 ngay qua" cua
  // bo loc deu suy tu no, khong tu dong ho trinh duyet.
  const today = await getServerToday();

  return <AttendanceReviewView today={today} />;
}
