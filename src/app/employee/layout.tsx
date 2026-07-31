import type { Metadata } from "next";

import { EmployeeShell } from "@/components/layout/employee-shell";

export const metadata: Metadata = {
  title: "Nhân viên",
};

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <EmployeeShell>{children}</EmployeeShell>;
}
