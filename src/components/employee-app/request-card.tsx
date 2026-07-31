import * as React from "react";
import { CalendarRange, Clock3, MessageSquareText } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { REQUEST_TYPE_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import type { WorkRequest } from "@/lib/types/domain";

/** The hien thi mot yeu cau cua nhan vien */
export function RequestCard({
  request,
  reviewerName,
}: {
  request: WorkRequest;
  reviewerName?: string | null;
}): React.ReactElement {
  const sameDay = request.fromDate === request.toDate;

  return (
    <article className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="heading-sm text-ink">{REQUEST_TYPE_LABEL[request.type]}</h3>
        <StatusBadge kind="request" value={request.status} size="sm" />
      </div>

      <dl className="mt-2.5 grid gap-1.5 text-[13px]">
        <div className="flex items-center gap-2 text-ink-secondary">
          <CalendarRange
            aria-hidden="true"
            className="size-3.5 shrink-0 text-ink-muted"
          />
          <dt className="sr-only">Khoảng thời gian</dt>
          <dd className="num">
            {sameDay
              ? formatDate(request.fromDate)
              : `${formatDate(request.fromDate)} – ${formatDate(request.toDate)}`}
            {request.fromTime && request.toTime
              ? ` · ${request.fromTime} – ${request.toTime}`
              : ""}
          </dd>
        </div>

        <div className="flex items-start gap-2 text-ink-secondary">
          <MessageSquareText
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-ink-muted"
          />
          <dt className="sr-only">Lý do</dt>
          <dd>{request.reason}</dd>
        </div>

        <div className="flex items-center gap-2 text-ink-muted">
          <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
          <dt className="sr-only">Thời điểm gửi</dt>
          <dd className="num text-xs">Gửi lúc {formatDateTime(request.createdAt)}</dd>
        </div>
      </dl>

      {request.reviewNote ? (
        <p className="mt-3 rounded-control border border-hairline bg-canvas-soft px-3 py-2 text-[13px] text-ink-secondary">
          <span className="font-medium text-ink">
            {reviewerName ? `${reviewerName}: ` : "Phản hồi: "}
          </span>
          {request.reviewNote}
        </p>
      ) : null}
    </article>
  );
}
