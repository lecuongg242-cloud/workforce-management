import type { Metadata } from "next";

import { ShiftsView } from "@/app/admin/shifts/shifts-view";

export const metadata: Metadata = {
  title: "Ca làm việc",
};

export default function ShiftsPage(): React.ReactElement {
  return <ShiftsView />;
}
