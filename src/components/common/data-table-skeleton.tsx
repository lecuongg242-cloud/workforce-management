import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Khung cho khi tai bang du lieu tren man hinh rong */
export function DataTableSkeleton({
  rows = 6,
  columns = 7,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("w-full", className)} aria-hidden="true">
      <div className="flex items-center gap-4 border-b border-hairline bg-canvas-soft px-3 py-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-hairline px-3 py-4 last:border-b-0"
        >
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          {Array.from({ length: columns - 1 }).map((_, cellIndex) => (
            <Skeleton key={cellIndex} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Khung cho danh sach the tren dien thoai */
export function CardListSkeleton({
  items = 4,
  className,
}: {
  items?: number;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("grid gap-3", className)} aria-hidden="true">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="surface-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
