import type { Metadata } from "next";

import { WorkSitesView } from "@/app/admin/work-sites/work-sites-view";

export const metadata: Metadata = {
  title: "Điểm làm việc",
};

export default function WorkSitesPage(): React.ReactElement {
  return <WorkSitesView />;
}
