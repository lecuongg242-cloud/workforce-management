import type { Metadata } from "next";

import { EmployeeHomeView } from "@/app/employee/employee-home-view";
import { getServerMonth, getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Trang chủ",
};

export default async function EmployeeHomePage(): Promise<React.ReactElement> {
  const [today, month] = await Promise.all([getServerToday(), getServerMonth()]);
  return <EmployeeHomeView today={today} month={month} />;
}
