import { redirect } from "next/navigation";

import { EmployeeShell } from "@/components/layout/employee-shell";
import { getSessionContextOrNull } from "@/lib/auth/session-context";

// Cung ly do voi `src/app/admin/layout.tsx`: khong dat title o tang layout,
// neu khong ca `/employee/*` se thoat khoi `template` cua layout goc.

/**
 * Cung mot ly do voi `src/app/admin/layout.tsx`: middleware da chan khach
 * chua dang nhap; o day xu ly rieng truong hop da dang nhap nhung chua co
 * doanh nghiep hien hanh xac dinh duoc.
 */
export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const context = await getSessionContextOrNull();
  if (!context) {
    redirect("/select-company");
  }
  return <EmployeeShell>{children}</EmployeeShell>;
}
