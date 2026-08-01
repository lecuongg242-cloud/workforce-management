"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useMockQuery } from "@/hooks/use-mock-query";
import { useSession } from "@/lib/auth/session-provider";
import { getEmployee } from "@/lib/data/employees";

/**
 * Khung giao dien nhan vien — thiet ke cho dien thoai truoc.
 *
 * Tren man hinh rong, noi dung duoc gioi han o mot cot hep dat giua nen
 * canvas-soft (mo phong dien thoai) chu KHONG dung lai sidebar quan tri.
 */
export function EmployeeShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const { status, session } = useSession();
  const employeeId = session?.user.employeeId ?? null;

  React.useEffect(() => {
    if (status === "guest") {
      router.replace("/login");
    }
  }, [status, router]);

  // Header hien thi ho so NHAN VIEN dang xem, khong phai ten tai khoan quan tri
  const { data: employee } = useMockQuery(
    () => (employeeId ? getEmployee(employeeId) : Promise.resolve(null)),
    [employeeId],
  );

  if (status !== "authenticated" || !session) {
    return (
      <div className="min-h-dvh bg-canvas-soft">
        <div className="mx-auto min-h-dvh max-w-md space-y-4 bg-white p-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-56 w-full rounded-card" />
          <Skeleton className="h-32 w-full rounded-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas-soft">
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-canvas-soft shadow-[0_0_0_1px_var(--tf-hairline)]">
        <MobileHeader
          userName={employee?.fullName ?? session.user.fullName}
          avatarUrl={employee?.avatarUrl ?? session.user.avatarUrl}
        />

        {/* Chua noi dung — chua san khoang trong bang chieu cao thanh dieu huong */}
        <main className="flex-1 px-4 pt-4 pb-[calc(var(--tf-bottomnav-h)+env(safe-area-inset-bottom,0px)+16px)]">
          {children}
        </main>

        <MobileBottomNav />
      </div>
    </div>
  );
}
