import type { Metadata } from "next";
import { Suspense } from "react";

import { RequestsView } from "@/app/employee/requests/requests-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getServerToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Yêu cầu",
};

export default async function EmployeeRequestsPage(): Promise<React.ReactElement> {
  const today = await getServerToday();

  return (
    <Suspense
      fallback={
        <div className="grid gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-36 w-full rounded-card" />
        </div>
      }
    >
      <RequestsView today={today} />
    </Suspense>
  );
}
