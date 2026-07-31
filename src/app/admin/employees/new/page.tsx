import type { Metadata } from "next";

import { NewEmployeeView } from "@/app/admin/employees/new/new-employee-view";

export const metadata: Metadata = {
  title: "Thêm nhân viên",
};

export default function NewEmployeePage(): React.ReactElement {
  return <NewEmployeeView />;
}
