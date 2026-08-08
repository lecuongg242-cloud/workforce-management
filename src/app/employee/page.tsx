import type { Metadata } from "next";

import { EmployeeHomeView } from "@/app/employee/employee-home-view";
import { getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Trang chủ",
};

export default async function EmployeeHomePage(): Promise<React.ReactElement> {
  const today = await getServerToday();
  return <EmployeeHomeView today={today} />;
}
