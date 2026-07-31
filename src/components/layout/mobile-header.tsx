"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { AppLogo } from "@/components/brand/app-logo";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { Button } from "@/components/ui/button";

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
          <Button
            variant="ghost"
            size="icon-mobile"
            aria-label="Thông báo (có 2 thông báo mới)"
            className="relative"
          >
            <Bell aria-hidden="true" />
            <span
              aria-hidden="true"
              className="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-danger ring-2 ring-white"
            />
          </Button>
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
