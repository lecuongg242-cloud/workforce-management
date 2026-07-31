import type { Metadata } from "next";

import { DepartmentsView } from "@/app/admin/departments/departments-view";

export const metadata: Metadata = {
  title: "Phòng ban",
};

export default function DepartmentsPage(): React.ReactElement {
  return <DepartmentsView />;
}
