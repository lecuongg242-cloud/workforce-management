import type { Metadata } from "next";

import { AttendanceReviewView } from "@/app/admin/attendance/review/attendance-review-view";

export const metadata: Metadata = {
  title: "Cần xem lại",
};

export default function AttendanceReviewPage(): React.ReactElement {
  return <AttendanceReviewView />;
}
