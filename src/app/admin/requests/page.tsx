import type { Metadata } from "next";

import { RequestsReviewView } from "@/app/admin/requests/requests-review-view";

export const metadata: Metadata = {
  title: "Yêu cầu",
};

export default function AdminRequestsPage(): React.ReactElement {
  return <RequestsReviewView />;
}
