"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDataQuery } from "@/hooks/use-data-query";
import { NOTIFICATION_LABEL } from "@/lib/constants";
import { listNotifications } from "@/lib/data/notifications";
import { formatNumber } from "@/lib/format";

/**
 * Chuong thong bao tren thanh tren cung cua giao dien nhan vien (APRV-05).
 *
 * TRUOC PLAN 05-04 day la mot chuong GIA: mot cham do co dinh va nhan
 * "(có 2 thông báo mới)" viet cung trong ma. Mot chi bao luon sang khong noi
 * gi ca — no chi day nguoi dung den cho ngung nhin vao no.
 *
 * `0` chua doc thi KHONG hien cham nao: khong co gi moi cung la mot thong tin.
 * Nhan tro nang cong so that de nguoi dung dung trinh doc man hinh biet duoc
 * dieu ma cai cham chi noi bang mau.
 */
export function NotificationBell(): React.ReactElement {
  const { data } = useDataQuery(() => listNotifications(), []);
  const unread = data?.unreadCount ?? 0;

  return (
    <Button
      variant="ghost"
      size="icon-mobile"
      asChild
      className="relative"
      aria-label={
        unread > 0
          ? `${NOTIFICATION_LABEL.bellLabel} (${formatNumber(unread)} chưa đọc)`
          : NOTIFICATION_LABEL.bellLabel
      }
    >
      <Link href="/employee/notifications">
        <Bell aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-danger ring-2 ring-white"
          />
        ) : null}
      </Link>
    </Button>
  );
}
