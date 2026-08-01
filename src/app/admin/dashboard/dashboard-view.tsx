"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarOff, Clock, Plus, UserCheck, Users } from "lucide-react";

import { DateRangePicker } from "@/components/common/date-range-picker";
import { ErrorState } from "@/components/common/error-state";
import { StatCard, StatCardSkeleton } from "@/components/common/stat-card";
import { AttendanceChart } from "@/components/dashboard/attendance-chart";
import { NotCheckedInCard } from "@/components/dashboard/not-checked-in-card";
import { PendingRequestsCard } from "@/components/dashboard/pending-requests-card";
import { TodayActivity } from "@/components/dashboard/today-activity";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentGreeting } from "@/hooks/use-current-greeting";
import { useMockQuery } from "@/hooks/use-mock-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { getDashboardSummary } from "@/lib/data/dashboard";
import { formatFullDate } from "@/lib/format";

export function DashboardView({ today }: { today: string }): React.ReactElement {
  const session = useAuthenticatedSession();
  const [date, setDate] = React.useState(today);

  const { data, isLoading, error, reload } = useMockQuery(
    () => getDashboardSummary(session.companyId, date),
    [session.companyId, date],
  );

  const greeting = useCurrentGreeting();

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`${greeting}, ${session.user.fullName}`}
        description={
          <>
            Đây là tình hình nhân sự hôm nay.{" "}
            <span className="num">{formatFullDate(date)}</span>
          </>
        }
        actions={
          <>
            <DateRangePicker value={date} onChange={setDate} />
            <Button asChild>
              <Link href="/admin/employees/new">
                <Plus aria-hidden="true" />
                Thêm nhân viên
              </Link>
            </Button>
          </>
        }
      />

      {error ? (
        <div className="surface-card">
          <ErrorState description={error} onRetry={reload} />
        </div>
      ) : (
        <>
          {/* Bon chi so chinh */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {isLoading || !data ? (
              Array.from({ length: 4 }).map((_, index) => (
                <StatCardSkeleton key={index} />
              ))
            ) : (
              <>
                <StatCard
                  label="Tổng nhân viên"
                  value={data.totalEmployees.value}
                  delta={data.totalEmployees.delta}
                  icon={Users}
                  tone="brand"
                />
                <StatCard
                  label="Đã chấm công"
                  value={data.checkedIn.value}
                  delta={data.checkedIn.delta}
                  icon={UserCheck}
                  tone="success"
                />
                <StatCard
                  label="Đi muộn"
                  value={data.late.value}
                  delta={data.late.delta}
                  icon={Clock}
                  tone="warning"
                  invertDelta
                />
                <StatCard
                  label="Đang nghỉ"
                  value={data.onLeave.value}
                  delta={data.onLeave.delta}
                  icon={CalendarOff}
                  tone="info"
                  invertDelta
                />
              </>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            {/* Cot trai */}
            <div className="grid gap-4">
              <section className="surface-card">
                <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3.5">
                  <div>
                    <h2 className="heading-sm text-ink">
                      Tình hình chấm công 7 ngày
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      So sánh số người đã chấm công, đi muộn và nghỉ
                    </p>
                  </div>
                </header>
                <div className="p-3 sm:p-4">
                  {isLoading || !data ? (
                    <Skeleton className="h-[280px] w-full rounded-control" />
                  ) : (
                    <AttendanceChart data={data.chart} />
                  )}
                </div>
              </section>

              <section className="surface-card">
                <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3.5">
                  <div>
                    <h2 className="heading-sm text-ink">Hoạt động hôm nay</h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Nhân viên đã chấm công, sắp xếp theo giờ vào
                    </p>
                  </div>
                </header>
                {isLoading || !data ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-11 w-full" />
                    ))}
                  </div>
                ) : (
                  <TodayActivity items={data.todayActivity} />
                )}
              </section>
            </div>

            {/* Cot phai */}
            <div className="grid gap-4 self-start">
              {isLoading || !data ? (
                <>
                  <Skeleton className="h-56 rounded-card" />
                  <Skeleton className="h-72 rounded-card" />
                </>
              ) : (
                <>
                  <PendingRequestsCard items={data.pendingRequests} />
                  <NotCheckedInCard items={data.notCheckedIn} />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
