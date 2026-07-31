import type { Metadata } from "next";

import { ProfileView } from "@/app/employee/profile/profile-view";

export const metadata: Metadata = {
  title: "Hồ sơ",
};

export default function EmployeeProfilePage(): React.ReactElement {
  return <ProfileView />;
}
