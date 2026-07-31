"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";

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
import type { Company } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/**
 * Chuyen doanh nghiep tren thanh cong cu.
 * Danh sach o day co chu dich la ngan gon; man `/select-company` moi la noi
 * hien thi day du dang the.
 */
export function CompanySwitcher({
  companies,
  currentCompanyId,
  className,
}: {
  companies: Company[];
  currentCompanyId: string;
  className?: string;
}): React.ReactElement {
  const router = useRouter();
  const { selectCompany } = useSession();
  const current = companies.find((item) => item.id === currentCompanyId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Chuyển doanh nghiệp"
        className={cn(
          "flex max-w-[220px] items-center gap-2 rounded-full border border-hairline px-2.5 py-1.5 text-left transition-colors hover:bg-canvas-soft",
          className,
        )}
      >
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-brand-wash text-brand-deep">
          <Building2 aria-hidden="true" className="size-3.5" />
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-[13px] text-ink lg:block">
          {current?.name ?? "Doanh nghiệp"}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-ink-muted" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-ink-muted">
          Doanh nghiệp của bạn
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            className="gap-2.5"
            onSelect={() => {
              if (company.id === currentCompanyId) return;
              selectCompany(company.id, company.role);
              router.push("/admin/dashboard");
            }}
          >
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-canvas-soft text-[12px] font-medium text-ink-secondary">
              {company.name.replace(/^Công ty |^Xưởng /u, "").charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] leading-tight text-ink">
                {company.name}
              </span>
              <span className="block truncate text-[11px] leading-tight text-ink-muted">
                {COMPANY_ROLE_LABEL[company.role]} · {company.employeeCount} nhân viên
              </span>
            </span>
            {company.id === currentCompanyId ? (
              <Check aria-hidden="true" className="size-4 shrink-0 text-brand" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/onboarding")}>
          <Plus aria-hidden="true" />
          Tạo doanh nghiệp mới
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
