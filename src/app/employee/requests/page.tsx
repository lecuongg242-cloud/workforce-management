import type { Metadata } from "next";
import { Suspense } from "react";

import { RequestsView } from "@/app/employee/requests/requests-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Yêu cầu",
};

export default function EmployeeRequestsPage(): React.ReactElement {
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
      <RequestsView />
    </Suspense>
  );
}
