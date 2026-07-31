import * as React from "react";
import Link from "next/link";
import {
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  PalmtreeIcon,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { REQUEST_TYPE_LABEL } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { PendingRequestSummary, RequestType } from "@/lib/types/domain";

const requestIcon: Record<RequestType, LucideIcon> = {
  leave: PalmtreeIcon,
  attendance_supplement: CalendarPlus,
  time_adjustment: Timer,
  overtime: ClipboardCheck,
};

/** The "Yeu cau cho duyet" ben phai dashboard */
export function PendingRequestsCard({
  items,
}: {
  items: PendingRequestSummary[];
}): React.ReactElement {
  const visible = items.filter((item) => item.count > 0);
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="surface-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3.5">
        <div>
          <h2 className="heading-sm text-ink">Yêu cầu chờ duyệt</h2>
          <p className="num mt-0.5 text-xs text-ink-muted">
            {formatNumber(total)} yêu cầu đang chờ
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employee/requests">Xem tất cả</Link>
        </Button>
      </header>

      {visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Không có yêu cầu chờ duyệt"
          description="Mọi yêu cầu đã được xử lý."
          compact
        />
      ) : (
        <ul className="grid gap-1 p-2">
          {visible.map((item) => {
            const Icon = requestIcon[item.type];
            return (
              <li key={item.type}>
                <Link
                  href="/employee/requests"
                  className="flex items-center gap-3 rounded-control px-2.5 py-2.5 transition-colors hover:bg-canvas-soft"
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-warning-soft text-warning">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">
                    {REQUEST_TYPE_LABEL[item.type]}
                  </span>
                  <span className="num inline-flex min-w-6 items-center justify-center rounded-full bg-neutral-soft px-1.5 py-0.5 text-xs font-medium text-ink">
                    {formatNumber(item.count)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
