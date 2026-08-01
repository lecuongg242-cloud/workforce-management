import type { Metadata } from "next";

import { NewEmployeeView } from "@/app/admin/employees/new/new-employee-view";
import { getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Thêm nhân viên",
};

export default async function NewEmployeePage(): Promise<React.ReactElement> {
  const today = await getServerToday();
  return <NewEmployeeView defaultStartDate={today} />;
}
