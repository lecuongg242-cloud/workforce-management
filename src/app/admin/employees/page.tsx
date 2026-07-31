import type { Metadata } from "next";

import { EmployeesView } from "@/app/admin/employees/employees-view";

export const metadata: Metadata = {
  title: "Nhân viên",
};

export default function EmployeesPage(): React.ReactElement {
  return <EmployeesView />;
}
