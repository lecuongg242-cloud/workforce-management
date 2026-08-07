import type { Metadata } from "next";

import { RequestsReviewView } from "@/app/admin/requests/requests-review-view";
import { getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Yêu cầu",
};

export default async function AdminRequestsPage(): Promise<React.ReactElement> {
  // "Hom nay" do SERVER cap (D-19) — cac moc "gui trong N ngay" cua bo loc
  // deu tinh tu no, khong tu dong ho trinh duyet.
  const today = await getServerToday();

  return <RequestsReviewView today={today} />;
}
