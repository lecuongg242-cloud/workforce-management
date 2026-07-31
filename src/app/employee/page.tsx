import type { Metadata } from "next";

import { EmployeeHomeView } from "@/app/employee/employee-home-view";

export const metadata: Metadata = {
  title: "Trang chủ",
};

export default function EmployeeHomePage(): React.ReactElement {
  return <EmployeeHomeView />;
}
