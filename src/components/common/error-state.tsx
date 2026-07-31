import * as React from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Trang thai loi kem hanh dong thu lai */
export function ErrorState({
  title = "Không tải được dữ liệu",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}): React.ReactElement {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full border border-danger-border bg-danger-soft text-danger">
        <TriangleAlert aria-hidden="true" className="size-5" />
      </span>
      <p className="heading-sm text-ink">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">
        {description ?? "Đã có lỗi xảy ra khi lấy dữ liệu. Vui lòng thử lại."}
      </p>
      {onRetry ? (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
