"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Clock3, Plus, Users } from "lucide-react";

import { AppLogo } from "@/components/brand/app-logo";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMockQuery } from "@/hooks/use-mock-query";
import { useSession } from "@/lib/auth/session-provider";
import { COMPANY_ROLE_LABEL } from "@/lib/constants";
import { listCompanies } from "@/lib/data/companies";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Company } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

const accentClass: Record<Company["accent"], string> = {
  indigo: "bg-brand text-white",
  navy: "bg-brand-dark text-white",
  ruby: "bg-[#ea2261] text-white",
  cream: "bg-canvas-cream text-ink",
};

export function SelectCompanyView(): React.ReactElement {
  const router = useRouter();
  const { status, session, selectCompany } = useSession();
  const { data: companies, isLoading, error, reload } = useMockQuery(
    () => listCompanies(),
    [],
  );

  React.useEffect(() => {
    if (status === "guest") router.replace("/login");
  }, [status, router]);

  const handleEnter = async (company: Company): Promise<void> => {
    await selectCompany(company.id);
    router.push("/admin/dashboard");
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:py-16">
      <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <AppLogo size="md" className="mb-6" />
          <h1 className="display-lg text-ink">Chọn doanh nghiệp</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {session
              ? `Xin chào ${session.user.fullName}, hãy chọn nơi bạn muốn làm việc hôm nay.`
              : "Chọn doanh nghiệp bạn muốn truy cập."}
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/login">Đăng nhập bằng tài khoản khác</Link>
        </Button>
      </div>

      {error ? (
        <div className="surface-card">
          <ErrorState description={error} onRetry={reload} />
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-52 rounded-card" />
          ))}
        </div>
      ) : !companies || companies.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={Building2}
            title="Bạn chưa thuộc doanh nghiệp nào"
            description="Hãy tạo doanh nghiệp đầu tiên để bắt đầu quản lý chấm công."
            action={
              <Button asChild>
                <Link href="/onboarding">Tạo doanh nghiệp mới</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <article
              key={company.id}
              className="surface-card flex flex-col p-5 transition-shadow hover:shadow-e2"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-11 shrink-0 items-center justify-center rounded-card text-[17px] font-medium",
                    accentClass[company.accent],
                  )}
                >
                  {company.name.replace(/^Công ty |^Xưởng /u, "").charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="heading-sm truncate text-ink">{company.name}</h2>
                  <p className="mt-0.5 text-[13px] text-ink-muted">
                    {COMPANY_ROLE_LABEL[company.role]}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid gap-2 text-[13px]">
                <div className="flex items-center gap-2 text-ink-secondary">
                  <Users aria-hidden="true" className="size-4 text-ink-muted" />
                  <dt className="sr-only">Tổng số nhân viên</dt>
                  <dd>
                    <span className="num font-medium">
                      {formatNumber(company.employeeCount)}
                    </span>{" "}
                    nhân viên
                  </dd>
                </div>
                <div className="flex items-center gap-2 text-ink-secondary">
                  <Clock3 aria-hidden="true" className="size-4 text-ink-muted" />
                  <dt className="sr-only">Lần truy cập gần nhất</dt>
                  <dd className="num">{formatDateTime(company.lastAccessedAt)}</dd>
                </div>
              </dl>

              <Button
                className="mt-5 w-full"
                onClick={() => handleEnter(company)}
              >
                Truy cập
                <ArrowRight aria-hidden="true" />
              </Button>
            </article>
          ))}

          <Link
            href="/onboarding"
            className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-card border border-dashed border-hairline-input bg-canvas-soft/60 p-5 text-center transition-colors hover:border-brand hover:bg-brand-wash/40"
          >
            <span className="inline-flex size-11 items-center justify-center rounded-card border border-hairline bg-white text-brand">
              <Plus aria-hidden="true" className="size-5" />
            </span>
            <span className="heading-sm text-ink">Tạo doanh nghiệp mới</span>
            <span className="max-w-[200px] text-[13px] text-ink-muted">
              Thiết lập doanh nghiệp mới chỉ trong ba bước.
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
