"use client";

import * as React from "react";
import { CheckCircle2, History, XCircle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { REQUEST_REVIEW_LABEL } from "@/lib/constants";
import { listRequestReviews } from "@/lib/data/requests";
import { formatDateTime } from "@/lib/format";

/**
 * Lich su xu ly cua mot yeu cau (APRV-04). Doc tu bang `request_reviews`
 * (append-only, migration 0017) chu KHONG tu ba cot review tren
 * `work_requests` — ba cot do chi giu duoc lan xu ly cuoi (D-33).
 *
 * Moi nhat truoc, do server sap xep. Trang thai duoc phan biet bang BIEU
 * TUONG + NHAN CHU, khong bang mau don thuan.
 */
export function RequestHistory({
  requestId,
}: {
  requestId: string;
}): React.ReactElement {
  const { data, isLoading, error } = useDataQuery(
    () => listRequestReviews(requestId),
    [requestId],
  );

  if (isLoading) {
    return (
      <div className="grid gap-2" aria-hidden="true">
        <Skeleton className="h-12 w-full rounded-control" />
        <Skeleton className="h-12 w-full rounded-control" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-[13px] text-danger">{REQUEST_REVIEW_LABEL.historyError}</p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-ink-muted">
        <History aria-hidden="true" className="size-4" />
        {REQUEST_REVIEW_LABEL.historyEmpty}
      </p>
    );
  }

  return (
    <ol className="grid gap-2.5">
      {data.map((review) => {
        const approved = review.decision === "approved";
        const Icon = approved ? CheckCircle2 : XCircle;
        return (
          <li
            key={review.id}
            className="rounded-control border border-hairline bg-canvas-soft p-3"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={
                  approved
                    ? "inline-flex items-center gap-1.5 text-[13px] font-medium text-success"
                    : "inline-flex items-center gap-1.5 text-[13px] font-medium text-danger"
                }
              >
                <Icon aria-hidden="true" className="size-4" />
                {approved
                  ? REQUEST_REVIEW_LABEL.approveAction
                  : REQUEST_REVIEW_LABEL.rejectAction}
              </span>
              <span className="text-[13px] text-ink-secondary">
                {/* `null` co nghia that: nguoi duyet khong co ho so nhan vien.
                    Noi "Quan tri vien" thay vi bo trong hoac bia mot cai ten. */}
                {review.reviewerName ?? REQUEST_REVIEW_LABEL.unknownReviewer}
              </span>
              <span className="num ml-auto text-xs text-ink-muted">
                {formatDateTime(review.createdAt)}
              </span>
            </div>
            {review.note ? (
              <p className="mt-1.5 text-[13px] text-ink-secondary">{review.note}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
