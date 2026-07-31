"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronsUpDown, LogOut } from "lucide-react";

import { AppLogo } from "@/components/brand/app-logo";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth/session-provider";
import { COMPANY_ROLE_LABEL } from "@/lib/constants";
import { ADMIN_NAV_ITEMS } from "@/lib/nav";
import type { Company } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/**
 * Thanh dieu huong ben trai cua khu vuc quan tri.
 * Tren may tinh bang va dien thoai, component nay duoc dat trong Sheet (drawer).
 */
export function AdminSidebar({
  company,
  onNavigate,
  onSignOut,
}: {
  company: Company | null;
  /** Goi khi chon mot muc — dung de dong drawer tren man hinh nho */
  onNavigate?: () => void;
  onSignOut: () => void;
}): React.ReactElement {
  const pathname = usePathname();
  const { session } = useSession();
  const [confirmSignOut, setConfirmSignOut] = React.useState(false);

  return (
    <div className="on-dark flex h-full flex-col bg-brand-dark text-white">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <Link
          href="/admin/dashboard"
          onClick={onNavigate}
          className="inline-flex rounded-md"
        >
          <AppLogo variant="light" />
        </Link>
      </div>

      {/* Doanh nghiep hien tai */}
      <div className="px-3">
        <Link
          href="/select-company"
          onClick={onNavigate}
          className="flex w-full items-center gap-2.5 rounded-control border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-white/10">
            <Building2 aria-hidden="true" className="size-4 text-white/85" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] leading-tight font-medium text-white">
              {company?.name ?? "Đang tải…"}
            </span>
            <span className="block truncate text-[11px] leading-tight text-white/55">
              {company ? COMPANY_ROLE_LABEL[company.role] : "—"}
            </span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-3.5 text-white/50" />
        </Link>
      </div>

      {/* Menu */}
      <nav aria-label="Điều hướng chính" className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
        <ul className="grid gap-0.5">
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            if (item.comingSoon) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled="true"
                    title="Chức năng sắp ra mắt"
                    className="flex cursor-not-allowed items-center gap-3 rounded-control px-3 py-2.5 text-sm text-white/40"
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium text-white/55">
                      Sắp ra mắt
                    </span>
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-white/12 font-medium text-white"
                      : "text-white/70 hover:bg-white/8 hover:text-white",
                  )}
                >
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-soft"
                    />
                  ) : null}
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tai khoan */}
      <div className="border-t border-white/10 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-white/8">
            <EmployeeAvatar
              name={session?.user.fullName ?? "?"}
              avatarUrl={session?.user.avatarUrl}
              size="sm"
              className="border border-white/15"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] leading-tight font-medium text-white">
                {session?.user.fullName ?? "—"}
              </span>
              <span className="block truncate text-[11px] leading-tight text-white/55">
                {session?.user.email ?? "—"}
              </span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="size-3.5 text-white/50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-60">
            <DropdownMenuLabel className="text-ink-muted">
              Tài khoản đang đăng nhập
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/employee">Chuyển sang giao diện nhân viên</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault();
                setConfirmSignOut(true);
              }}
            >
              <LogOut aria-hidden="true" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Đăng xuất khỏi TimeFlow?"
        description="Bạn sẽ cần đăng nhập lại để tiếp tục quản lý chấm công."
        confirmLabel="Đăng xuất"
        tone="destructive"
        onConfirm={() => {
          setConfirmSignOut(false);
          onSignOut();
        }}
      />
    </div>
  );
}
