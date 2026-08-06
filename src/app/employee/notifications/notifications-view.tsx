"use client";

import * as React from "react";
import Link from "next/link";
import { BellOff, ChevronRight, Circle } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { NOTIFICATION_LABEL } from "@/lib/constants";
import { listNotifications, markNotificationsRead } from "@/lib/data/notifications";
import { useDataStore } from "@/lib/data/store";
import { formatDateTime } from "@/lib/format";

/**
 * Danh sach thong bao cua nhan vien (APRV-05, plan 05-04).
 *
 * MO MAN HINH LA DA DOC: nguoi dung da nhin thay noi dung roi, bat ho bam
 * them mot nut "danh dau da doc" chi de lam so tren chuong ve 0 la bat ho lam
 * viec cho he thong. Lan danh dau chay MOT LAN cho cac dong dang hien (khong
 * theo doi cuon) — du de con so tren chuong khop voi thuc te.
 *
 * Dong chua doc phan biet bang DAU CHAM + NHAN CHU, khong bang mau don thuan.
 */
export function NotificationsView(): React.ReactElement {
  const { invalidate } = useDataStore();
  const { data, isLoading, error, reload } = useDataQuery(
    () => listNotifications(),
    [],
  );

  // Chi danh dau MOT LAN cho moi tap dong da thay — `useRef` de lan re-render
  // sau khi `invalidate()` khong kich hoat mot vong danh dau thu hai.
  const markedRef = React.useRef(false);

  React.useEffect(() => {
    if (markedRef.current || !data) return;
    const unreadIds = data.items
      .filter((item) => item.readAt === null)
      .map((item) => item.id);
    if (unreadIds.length === 0) return;

    markedRef.current = true;
    markNotificationsRead(unreadIds)
      .then((changed) => {
        // `invalidate()` de chuong o thanh tren cung doc lai so chua doc —
        // hai cho phai noi cung mot con so.
        if (changed > 0) invalidate();
      })
      .catch(() => {
        // Danh dau da doc that bai khong lam hong man hinh: noi dung van doc
        // duoc, va lan mo sau se thu lai.
        markedRef.current = false;
      });
  }, [data, invalidate]);

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="display-md text-ink">{NOTIFICATION_LABEL.pageTitle}</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          {NOTIFICATION_LABEL.pageDescription}
        </p>
      </header>

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : isLoading || !data ? (
        <>
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
        </>
      ) : data.items.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={BellOff}
            title={NOTIFICATION_LABEL.emptyTitle}
            description={NOTIFICATION_LABEL.emptyBody}
            compact
          />
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {data.items.map((item) => {
            const unread = item.readAt === null;
            const content = (
              <>
                <div className="flex items-start gap-2">
                  {unread ? (
                    <Circle
                      aria-hidden="true"
                      className="mt-1 size-2 shrink-0 fill-brand text-brand"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[13px] text-ink-secondary">
                      {item.body}
                    </p>
                  </div>
                  {item.requestId ? (
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-ink-muted"
                    />
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="num text-xs text-ink-muted">
                    {formatDateTime(item.createdAt)}
                  </span>
                  {/* Nhan CHU ben canh dau cham — trang thai khong bao gio chi
                      duoc phan biet bang mau. */}
                  {unread ? (
                    <span className="rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-medium text-brand-deep">
                      {NOTIFICATION_LABEL.unreadLabel}
                    </span>
                  ) : null}
                </div>
              </>
            );

            return (
              <li key={item.id} className="surface-card p-4">
                {item.requestId ? (
                  <Link
                    href="/employee/requests"
                    className="block rounded-control focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
