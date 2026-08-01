import type { Metadata } from "next";

import { EmployeeDetailView } from "@/app/admin/employees/[id]/employee-detail-view";
import { getServerMonth, getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Chi tiết nhân viên",
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const month = await getServerMonth();
  // Chi dung khi bieu mau sua nhan vien mo o man hinh nay (EmployeeForm
  // mode="edit") -- nhanh do khong dung defaultStartDate (van lay tu
  // employee.startDate hien co), nhung prop la bat buoc theo chu ky ham.
  const today = await getServerToday();
  return <EmployeeDetailView employeeId={id} month={month} today={today} />;
}
