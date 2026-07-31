import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Thanh hanh dong dinh o day bieu mau.
 * Tren dien thoai co them padding vung an toan cua iPhone.
 */
export function StickyFormActions({
  children,
  hint,
  className,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "safe-bottom sticky bottom-0 z-20 -mx-4 mt-2 border-t border-hairline bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {hint ? (
          <p className="text-[13px] text-ink-muted">{hint}</p>
        ) : (
          <span className="hidden sm:block" />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {children}
        </div>
      </div>
    </div>
  );
}
