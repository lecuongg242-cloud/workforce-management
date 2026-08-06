import type { Metadata } from "next";

import { PayrollView } from "@/app/admin/payroll/payroll-view";
import { getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Bảng lương",
};

export default async function AdminPayrollPage(): Promise<React.ReactElement> {
  // "Hom nay" do SERVER cap (D-19) — thang mac dinh cua man hinh suy tu no.
  const today = await getServerToday();

  return <PayrollView today={today} />;
}
