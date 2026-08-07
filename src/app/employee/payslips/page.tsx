import type { Metadata } from "next";

import { PayslipsView } from "@/app/employee/payslips/payslips-view";

export const metadata: Metadata = {
  title: "Phiếu lương",
};

export default function EmployeePayslipsPage(): React.ReactElement {
  return <PayslipsView />;
}
