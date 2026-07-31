import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatDelta, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The chi so cho dashboard.
 * Nen luon la mau trang — chi bieu tuong va nhan chenh lech doi mau,
 * tranh bon the ruc ro canh nhau.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaLabel = "so với hôm qua",
  icon: Icon,
  tone = "brand",
  /** Chenh lech giam la tot (vi du: so nguoi di muon) */
  invertDelta = false,
  className,
}: {
  label: string;
  value: number;
  delta?: number;
  deltaLabel?: string;
  icon: LucideIcon;
  tone?: "brand" | "success" | "warning" | "info";
  invertDelta?: boolean;
  className?: string;
}): React.ReactElement {
  const iconTone: Record<string, string> = {
    brand: "bg-brand-wash text-brand-deep",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
  };

  const hasDelta = typeof delta === "number";
  const isPositive = hasDelta && delta > 0;
  const isNegative = hasDelta && delta < 0;
  const isGood = invertDelta ? isNegative : isPositive;
  const isBad = invertDelta ? isPositive : isNegative;

  const DeltaIcon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;

  return (
    <div className={cn("surface-card p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] leading-snug text-ink-muted">{label}</p>
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-[10px]",
            iconTone[tone],
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>

      <p className="num display-lg mt-3 text-ink">{formatNumber(value)}</p>

      {hasDelta ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
              isGood && "bg-success-soft text-success",
              isBad && "bg-warning-soft text-warning",
              !isGood && !isBad && "bg-neutral-soft text-neutral-ink",
            )}
          >
            <DeltaIcon aria-hidden="true" className="size-3" />
            <span className="num">{formatDelta(delta)}</span>
          </span>
          <span className="text-ink-muted">{deltaLabel}</span>
        </p>
      ) : null}
    </div>
  );
}

export function StatCardSkeleton(): React.ReactElement {
  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-8 rounded-[10px]" />
      </div>
      <Skeleton className="mt-4 h-8 w-16" />
      <Skeleton className="mt-3 h-4 w-32" />
    </div>
  );
}
