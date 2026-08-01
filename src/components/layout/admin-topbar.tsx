"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight, Menu, PanelsTopLeft } from "lucide-react";

import { CompanySwitcher } from "@/components/layout/company-switcher";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { SearchInput } from "@/components/common/search-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDebounce } from "@/hooks/use-debounce";
import { useDataQuery } from "@/hooks/use-data-query";
import { useSession } from "@/lib/auth/session-provider";
import { BREADCRUMB_LABELS } from "@/lib/nav";
import { listAllEmployees } from "@/lib/data/employees";
import { normalizeText } from "@/lib/format";
import type { Company } from "@/lib/types/domain";

interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";

  segments.forEach((segment, index) => {
    href += `/${segment}`;
    // Bo qua doan "admin" o dau va cac id dong (nv-01, ca-02...)
    if (index === 0 && segment === "admin") return;
    const label =
      BREADCRUMB_LABELS[segment] ??
      (segment.includes("-") ? "Chi tiết" : segment);
    crumbs.push({ label, href });
  });

  return crumbs;
}

export function AdminTopbar({
  companies,
  currentCompanyId,
  onOpenSidebar,
  onSignOut,
}: {
  companies: Company[];
  currentCompanyId: string;
  onOpenSidebar: () => void;
  onSignOut: () => void;
}): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();
  const crumbs = buildCrumbs(pathname);

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 250);

  const { data: employees } = useDataQuery(
    () => listAllEmployees(currentCompanyId),
    [currentCompanyId],
  );

  const suggestions = React.useMemo(() => {
    if (!debouncedSearch.trim() || !employees) return [];
    const keyword = normalizeText(debouncedSearch);
    return employees
      .filter((employee) =>
        normalizeText(`${employee.fullName} ${employee.code}`).includes(keyword),
      )
      .slice(0, 6);
  }, [debouncedSearch, employees]);

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-white/95 backdrop-blur">
      <div className="flex h-topbar items-center gap-3 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Mở menu điều hướng"
          onClick={onOpenSidebar}
          className="lg:hidden"
        >
          <Menu aria-hidden="true" />
        </Button>

        {/* Breadcrumb */}
        <nav aria-label="Đường dẫn" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1 text-[13px]">
            <li className="hidden sm:block">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center gap-1.5 rounded-sm text-ink-muted hover:text-ink"
              >
                <PanelsTopLeft aria-hidden="true" className="size-3.5" />
                Quản trị
              </Link>
            </li>
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li key={crumb.href} className="flex min-w-0 items-center gap-1">
                  <ChevronRight
                    aria-hidden="true"
                    className="hidden size-3.5 shrink-0 text-ink-muted/60 sm:block"
                  />
                  {isLast ? (
                    <span
                      aria-current="page"
                      className="truncate font-medium text-ink"
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="truncate rounded-sm text-ink-muted hover:text-ink"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Tim kiem nhanh */}
        <div className="relative hidden md:block">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            label="Tìm nhanh nhân viên"
            placeholder="Tìm nhân viên…"
            className="w-56 xl:w-72"
            inputClassName="h-9 text-sm"
          />
          {suggestions.length > 0 ? (
            <ul className="absolute top-full right-0 left-0 z-40 mt-1.5 overflow-hidden rounded-control border border-hairline bg-white py-1 shadow-e2">
              {suggestions.map((employee) => (
                <li key={employee.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      router.push(`/admin/employees/${employee.id}`);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-canvas-soft"
                  >
                    <EmployeeAvatar
                      name={employee.fullName}
                      avatarUrl={employee.avatarUrl}
                      size="xs"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">
                        {employee.fullName}
                      </span>
                      <span className="num block truncate text-[11px] text-ink-muted">
                        {employee.code}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Thông báo (có 3 thông báo mới)"
          className="relative"
        >
          <Bell aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-danger ring-2 ring-white"
          />
        </Button>

        <CompanySwitcher
          companies={companies}
          currentCompanyId={currentCompanyId}
        />

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Tài khoản người dùng"
            className="rounded-full"
          >
            <EmployeeAvatar
              name={session?.user.fullName ?? "?"}
              avatarUrl={session?.user.avatarUrl}
              size="sm"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <span className="block text-[13px] font-medium text-ink">
                {session?.user.fullName}
              </span>
              <span className="block text-[11px] font-normal text-ink-muted">
                {session?.user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/employee">Giao diện nhân viên</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/select-company">Chọn doanh nghiệp</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
