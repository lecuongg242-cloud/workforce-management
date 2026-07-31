"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { RequestCard } from "@/components/employee-app/request-card";
import { RequestFormSheet } from "@/components/employee-app/request-form-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMockQuery } from "@/hooks/use-mock-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { formatNumber } from "@/lib/format";
import {
  createRequest,
  listAllEmployees,
  listRequests,
} from "@/lib/mock/service";
import { useMockData } from "@/lib/mock/store";
import type { RequestStatus, RequestType, WorkRequest } from "@/lib/types/domain";
import type { WorkRequestFormValues } from "@/lib/validation/schemas";

const TABS: Array<{ value: RequestStatus | "all"; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
];

const REQUEST_TYPES: RequestType[] = [
  "leave",
  "attendance_supplement",
  "time_adjustment",
  "overtime",
];

function isRequestType(value: string | null): value is RequestType {
  return value !== null && REQUEST_TYPES.includes(value as RequestType);
}

export function RequestsView(): React.ReactElement {
  const session = useAuthenticatedSession();
  const searchParams = useSearchParams();
  const { invalidate } = useMockData();
  const employeeId = session.user.employeeId;

  const typeParam = searchParams.get("type");
  const defaultType = isRequestType(typeParam) ? typeParam : undefined;

  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Mo san bieu mau khi duoc dieu huong tu thao tac nhanh
  React.useEffect(() => {
    if (defaultType) setSheetOpen(true);
  }, [defaultType]);

  const { data, isLoading, error, reload } = useMockQuery(
    async () => {
      const [requests, employees] = await Promise.all([
        listRequests({ companyId: session.companyId, employeeId }),
        listAllEmployees(session.companyId),
      ]);
      return { requests, employees };
    },
    [session.companyId, employeeId],
  );

  const reviewerNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    data?.employees.forEach((employee) => {
      map[employee.id] = employee.fullName;
    });
    return map;
  }, [data]);

  const countBy = (status: RequestStatus | "all"): number => {
    if (!data) return 0;
    return status === "all"
      ? data.requests.length
      : data.requests.filter((request) => request.status === status).length;
  };

  const filterBy = (status: RequestStatus | "all"): WorkRequest[] => {
    if (!data) return [];
    return status === "all"
      ? data.requests
      : data.requests.filter((request) => request.status === status);
  };

  const handleSubmit = async (values: WorkRequestFormValues): Promise<void> => {
    try {
      await createRequest(session.companyId, employeeId, values);
      invalidate();
      setSheetOpen(false);
      toast.success("Đã gửi yêu cầu", {
        description: "Quản lý sẽ nhận được thông báo để duyệt.",
      });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không gửi được yêu cầu.",
      );
    }
  };

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="display-md text-ink">Yêu cầu</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Theo dõi trạng thái các yêu cầu bạn đã gửi.
        </p>
      </header>

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : isLoading || !data ? (
        <>
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-36 w-full rounded-card" />
          <Skeleton className="h-36 w-full rounded-card" />
        </>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="no-scrollbar w-full justify-start overflow-x-auto">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="shrink-0">
                {tab.label}
                <span className="num ml-1.5 text-[11px] text-ink-muted">
                  {formatNumber(countBy(tab.value))}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => {
            const items = filterBy(tab.value);
            return (
              <TabsContent key={tab.value} value={tab.value} className="mt-3">
                {items.length === 0 ? (
                  <div className="surface-card">
                    <EmptyState
                      icon={ClipboardList}
                      title={
                        tab.value === "all"
                          ? "Bạn chưa gửi yêu cầu nào"
                          : `Không có yêu cầu ở mục “${tab.label}”`
                      }
                      description={
                        tab.value === "all"
                          ? "Tạo yêu cầu khi cần xin nghỉ, bổ sung công hoặc đăng ký tăng ca."
                          : "Các yêu cầu thuộc trạng thái này sẽ hiển thị tại đây."
                      }
                      compact
                      action={
                        tab.value === "all" ? (
                          <Button onClick={() => setSheetOpen(true)}>
                            <Plus aria-hidden="true" />
                            Tạo yêu cầu
                          </Button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <ul className="grid gap-2.5">
                    {items.map((request) => (
                      <li key={request.id}>
                        <RequestCard
                          request={request}
                          reviewerName={
                            request.reviewerId
                              ? reviewerNames[request.reviewerId]
                              : null
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Nut noi tao yeu cau — dat tren thanh dieu huong duoi */}
      <Button
        size="lg"
        onClick={() => setSheetOpen(true)}
        className="fixed right-4 bottom-[calc(var(--tf-bottomnav-h)+env(safe-area-inset-bottom,0px)+12px)] z-30 shadow-e2 md:right-[max(1rem,calc(50%-13rem))]"
      >
        <Plus aria-hidden="true" />
        Tạo yêu cầu
      </Button>

      <RequestFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        defaultType={defaultType}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
