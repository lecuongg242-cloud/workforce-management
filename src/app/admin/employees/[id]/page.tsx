import type { Metadata } from "next";

import { EmployeeDetailView } from "@/app/admin/employees/[id]/employee-detail-view";
import { getServerMonth } from "@/lib/today";

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
  return <EmployeeDetailView employeeId={id} month={month} />;
}
