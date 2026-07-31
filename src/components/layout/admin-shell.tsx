"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMockQuery } from "@/hooks/use-mock-query";
import { useSession } from "@/lib/auth/session-provider";
import { listCompanies } from "@/lib/mock/service";

/**
 * Khung giao dien quan tri: sidebar + topbar + noi dung.
 *
 * Chan truy cap o phia trinh duyet vi phien dang nhap gia lap nam trong
 * localStorage — middleware cua Next khong doc duoc. Khi chuyen sang
 * Supabase Auth, phan chan nay se thay bang middleware doc cookie.
 */
export function AdminShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const { status, session, signOut } = useSession();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    if (status === "guest") {
      router.replace("/login");
    }
  }, [status, router]);

  const { data: companies } = useMockQuery(() => listCompanies(), []);

  const handleSignOut = React.useCallback(() => {
    signOut();
    router.replace("/login");
  }, [signOut, router]);

  if (status !== "authenticated" || !session) {
    return <AdminShellSkeleton />;
  }

  const currentCompany =
    companies?.find((company) => company.id === session.companyId) ?? null;

  return (
    <div className="min-h-dvh bg-canvas-soft">
      {/* Sidebar co dinh tren man hinh rong */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-sidebar lg:block">
        <AdminSidebar company={currentCompany} onSignOut={handleSignOut} />
      </aside>

      {/* Drawer tren may tinh bang va dien thoai */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[280px] border-0 p-0">
          <SheetTitle className="sr-only">Điều hướng quản trị</SheetTitle>
          <AdminSidebar
            company={currentCompany}
            onNavigate={() => setDrawerOpen(false)}
            onSignOut={handleSignOut}
          />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-sidebar">
        <AdminTopbar
          companies={companies ?? []}
          currentCompanyId={session.companyId}
          onOpenSidebar={() => setDrawerOpen(true)}
          onSignOut={handleSignOut}
        />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminShellSkeleton(): React.ReactElement {
  return (
    <div className="min-h-dvh bg-canvas-soft">
      <div className="fixed inset-y-0 left-0 hidden w-sidebar bg-brand-dark lg:block" />
      <div className="lg:pl-sidebar">
        <div className="h-topbar border-b border-hairline bg-white" />
        <div className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-8 lg:px-8">
          <Skeleton className="h-9 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-card" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-card" />
        </div>
      </div>
    </div>
  );
}
