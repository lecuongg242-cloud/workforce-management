import type { Metadata } from "next";

import { PayslipDetailView } from "@/app/employee/payslips/[month]/payslip-detail-view";
import { formatMonthLabel } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<Metadata> {
  const { month } = await params;
  return { title: `Phiếu lương ${formatMonthLabel(month)}` };
}

export default async function EmployeePayslipPage({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<React.ReactElement> {
  const { month } = await params;
  return <PayslipDetailView month={month} />;
}
