import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeesLoading(): React.ReactElement {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-10 w-36 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </div>
      <div className="surface-card overflow-hidden">
        <div className="flex gap-2.5 border-b border-hairline p-3">
          <Skeleton className="h-10 w-full lg:w-72" />
        </div>
        <DataTableSkeleton />
      </div>
    </div>
  );
}
