import type { Metadata } from "next";

import { AdminShell } from "@/components/layout/admin-shell";

export const metadata: Metadata = {
  title: "Quản trị",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <AdminShell>{children}</AdminShell>;
}
