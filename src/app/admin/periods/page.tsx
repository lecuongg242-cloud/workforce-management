import type { Metadata } from "next";

import { PeriodsView } from "@/app/admin/periods/periods-view";

export const metadata: Metadata = {
  title: "Kỳ công",
};

export default function AdminPeriodsPage(): React.ReactElement {
  return <PeriodsView />;
}
