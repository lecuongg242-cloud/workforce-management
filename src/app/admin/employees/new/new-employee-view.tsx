"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ErrorState } from "@/components/common/error-state";
import { EmployeeForm } from "@/components/employees/employee-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { listDepartments } from "@/lib/data/departments";
import { listAllEmployees } from "@/lib/data/employees";
import { listShifts } from "@/lib/data/shifts";

export function NewEmployeeView({
  defaultStartDate,
}: {
  defaultStartDate: string;
}): React.ReactElement {
  const session = useAuthenticatedSession();

  const { data, isLoading, error, reload } = useDataQuery(
    async () => {
      const [departments, shifts, employees] = await Promise.all([
        listDepartments(session.companyId),
        listShifts(session.companyId),
        listAllEmployees(session.companyId),
      ]);
      return { departments, shifts, employees };
    },
    [session.companyId],
  );

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/admin/employees">
            <ArrowLeft aria-hidden="true" />
            Quay lại danh sách
          </Link>
        </Button>
        <PageHeader
          title="Thêm nhân viên"
          description="Điền thông tin để tạo hồ sơ nhân viên mới và gửi lời mời đăng nhập."
        />
      </div>

      <section className="surface-card px-4 py-2 sm:px-6">
        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading || !data ? (
          <div className="space-y-6 py-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="grid gap-4 lg:grid-cols-[260px_1fr]">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, cell) => (
                    <Skeleton key={cell} className="h-16" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmployeeForm
            mode="create"
            companyId={session.companyId}
            departments={data.departments}
            shifts={data.shifts}
            allEmployees={data.employees}
            defaultStartDate={defaultStartDate}
          />
        )}
      </section>
    </div>
  );
}
