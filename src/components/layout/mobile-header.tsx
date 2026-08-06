"use client";

import * as React from "react";
import Link from "next/link";

import { AppLogo } from "@/components/brand/app-logo";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { NotificationBell } from "@/components/employee-app/notification-bell";

/** Thanh tren cung cua man hinh nhan vien — thap, gon, khong chiem cho */
export function MobileHeader({
  userName,
  avatarUrl,
}: {
  userName: string;
  avatarUrl: string | null;
}): React.ReactElement {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-hairline bg-white/97 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Link href="/employee" className="inline-flex rounded-md">
          <AppLogo size="sm" />
        </Link>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <Link
            href="/employee/profile"
            aria-label="Hồ sơ cá nhân"
            className="inline-flex size-11 items-center justify-center rounded-full"
          >
            <EmployeeAvatar name={userName} avatarUrl={avatarUrl} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}
