import type { Metadata } from "next";

import { AttendanceView } from "@/app/admin/attendance/attendance-view";
import { getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Chấm công",
};

export default async function AdminAttendancePage(): Promise<React.ReactElement> {
  // "Hom nay" do SERVER cap (D-19) — thang khoi tao cua man hinh suy tu no.
  const today = await getServerToday();

  return <AttendanceView today={today} />;
}
