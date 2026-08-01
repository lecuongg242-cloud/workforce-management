"use client";

import * as React from "react";
import Link from "next/link";
import { FileSpreadsheet, Plus, SearchX, Users, X } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  CardListSkeleton,
  DataTableSkeleton,
} from "@/components/common/data-table-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FilterBar } from "@/components/common/filter-bar";
import { SearchInput } from "@/components/common/search-input";
import { EmployeeMobileCard } from "@/components/employees/employee-mobile-card";
import { EmployeeTable } from "@/components/employees/employee-table";
import { MoveDepartmentDialog } from "@/components/employees/move-department-dialog";
import { PaginationBar } from "@/components/employees/pagination-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import {
  CONTRACT_TYPE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  EMPLOYEE_STATUS_OPTIONS,
} from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { listDepartments } from "@/lib/data/departments";
import {
  bulkMoveDepartment,
  listEmployees,
  updateEmployee,
} from "@/lib/data/employees";
import { useDataStore } from "@/lib/data/store";
import type {
  ContractType,
  Employee,
  EmployeeStatus,
} from "@/lib/types/domain";

export function EmployeesView(): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const [search, setSearch] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState<string>("all");
  const [status, setStatus] = React.useState<EmployeeStatus | "all">("all");
  const [contractType, setContractType] = React.useState<ContractType | "all">(
    "all",
  );
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [moveTarget, setMoveTarget] = React.useState<Employee[] | null>(null);
  const [terminateTarget, setTerminateTarget] = React.useState<Employee | null>(
    null,
  );
  const [isPending, setIsPending] = React.useState(false);

  const debouncedSearch = useDebounce(search, 300);

  // Doi bo loc thi quay ve trang dau
  React.useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [debouncedSearch, departmentId, status, contractType, pageSize]);

  const { data: departments } = useDataQuery(
    () => listDepartments(session.companyId),
    [session.companyId],
  );

  const { data, isLoading, error, reload } = useDataQuery(
    () =>
      listEmployees({
        companyId: session.companyId,
        search: debouncedSearch,
        departmentId,
        status,
        contractType,
        page,
        pageSize,
      }),
    [
      session.companyId,
      debouncedSearch,
      departmentId,
      status,
      contractType,
      page,
      pageSize,
    ],
  );

  const departmentNames = React.useMemo(() => {
    const map: Record<string, string> = {};
    departments?.forEach((department) => {
      map[department.id] = department.name;
    });
    return map;
  }, [departments]);

  const hasActiveFilter =
    search.trim() !== "" ||
    departmentId !== "all" ||
    status !== "all" ||
    contractType !== "all";

  const resetFilters = (): void => {
    setSearch("");
    setDepartmentId("all");
    setStatus("all");
    setContractType("all");
  };

  const employees = data?.items ?? [];

  const toggleOne = (id: string, checked: boolean): void => {
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  };

  const toggleAll = (checked: boolean): void => {
    setSelectedIds(checked ? employees.map((employee) => employee.id) : []);
  };

  const selectedEmployees = employees.filter((employee) =>
    selectedIds.includes(employee.id),
  );

  const handleMove = async (targetDepartmentId: string): Promise<void> => {
    if (!moveTarget) return;
    setIsPending(true);
    try {
      const moved = await bulkMoveDepartment(
        moveTarget.map((employee) => employee.id),
        targetDepartmentId,
      );
      invalidate();
      setSelectedIds([]);
      setMoveTarget(null);
      toast.success(
        `Đã chuyển ${formatNumber(moved)} nhân viên sang ${departmentNames[targetDepartmentId]}.`,
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không chuyển được phòng ban.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleTerminate = async (): Promise<void> => {
    if (!terminateTarget) return;
    setIsPending(true);
    try {
      await updateEmployee(terminateTarget.id, { status: "terminated" });
      invalidate();
      toast.success(`Đã cập nhật trạng thái cho ${terminateTarget.fullName}.`);
      setTerminateTarget(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không cập nhật được trạng thái.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleResendInvite = (employee: Employee): void => {
    toast.success(`Đã gửi lại lời mời tới ${employee.email}.`);
  };

  const activeCount = data
    ? employees.filter((employee) => employee.status === "active").length
    : 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Nhân viên"
        description={
          data ? (
            <>
              Đang quản lý{" "}
              <span className="num font-medium text-ink">
                {formatNumber(data.total)}
              </span>{" "}
              nhân viên
              {hasActiveFilter ? " khớp bộ lọc" : ""}, trong đó{" "}
              <span className="num font-medium text-ink">
                {formatNumber(activeCount)}
              </span>{" "}
              người đang làm việc ở trang này.
            </>
          ) : (
            "Đang tải danh sách nhân viên…"
          )
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                toast.info("Tính năng nhập từ Excel sẽ có ở giai đoạn tiếp theo.")
              }
            >
              <FileSpreadsheet aria-hidden="true" />
              Nhập từ Excel
            </Button>
            <Button asChild>
              <Link href="/admin/employees/new">
                <Plus aria-hidden="true" />
                Thêm nhân viên
              </Link>
            </Button>
          </>
        }
      />

      <section className="surface-card overflow-hidden">
        <FilterBar
          search={
            <SearchInput
              value={search}
              onValueChange={setSearch}
              label="Tìm theo tên, mã hoặc số điện thoại"
              placeholder="Tên, mã hoặc số điện thoại…"
            />
          }
          filters={[
            {
              id: "filter-department",
              label: "Lọc theo phòng ban",
              value: departmentId,
              allLabel: "Tất cả phòng ban",
              options:
                departments?.map((department) => ({
                  value: department.id,
                  label: department.name,
                })) ?? [],
              onChange: setDepartmentId,
            },
            {
              id: "filter-status",
              label: "Lọc theo trạng thái",
              value: status,
              allLabel: "Tất cả trạng thái",
              options: EMPLOYEE_STATUS_OPTIONS,
              onChange: (value) => setStatus(value as EmployeeStatus | "all"),
            },
            {
              id: "filter-contract",
              label: "Lọc theo loại hợp đồng",
              value: contractType,
              allLabel: "Tất cả hợp đồng",
              options: CONTRACT_TYPE_OPTIONS,
              onChange: (value) => setContractType(value as ContractType | "all"),
            },
          ]}
          hasActiveFilter={hasActiveFilter}
          onReset={resetFilters}
        />

        {/* Thanh hanh dong hang loat */}
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline bg-brand-wash px-4 py-2.5">
            <p className="num text-[13px] font-medium text-brand-deep">
              Đã chọn {formatNumber(selectedIds.length)} nhân viên
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMoveTarget(selectedEmployees)}
            >
              Chuyển phòng ban
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="ml-auto"
            >
              <X aria-hidden="true" />
              Bỏ chọn
            </Button>
          </div>
        ) : null}

        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading ? (
          <>
            <div className="hidden md:block">
              <DataTableSkeleton rows={pageSize > 10 ? 8 : 6} columns={7} />
            </div>
            <div className="p-4 md:hidden">
              <CardListSkeleton items={5} />
            </div>
          </>
        ) : employees.length === 0 ? (
          hasActiveFilter ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy nhân viên phù hợp"
              description="Thử đổi từ khóa hoặc xóa bớt bộ lọc đang áp dụng."
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  Xóa bộ lọc
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Chưa có nhân viên nào"
              description="Thêm nhân viên đầu tiên để bắt đầu ghi nhận chấm công."
              action={
                <Button asChild>
                  <Link href="/admin/employees/new">
                    <Plus aria-hidden="true" />
                    Thêm nhân viên
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* Bang cho man hinh rong */}
            <div className="hidden md:block">
              <EmployeeTable
                employees={employees}
                departmentNames={departmentNames}
                selectedIds={selectedIds}
                onToggleOne={toggleOne}
                onToggleAll={toggleAll}
                onMoveDepartment={(employee) => setMoveTarget([employee])}
                onResendInvite={handleResendInvite}
                onTerminate={setTerminateTarget}
              />
            </div>

            {/* The cho dien thoai */}
            <div className="grid gap-2.5 p-3 md:hidden">
              {employees.map((employee) => (
                <EmployeeMobileCard
                  key={employee.id}
                  employee={employee}
                  departmentName={departmentNames[employee.departmentId] ?? "—"}
                  isSelected={selectedIds.includes(employee.id)}
                  onToggle={toggleOne}
                  onMoveDepartment={(item) => setMoveTarget([item])}
                  onResendInvite={handleResendInvite}
                  onTerminate={setTerminateTarget}
                />
              ))}
            </div>

            {data ? (
              <PaginationBar
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                totalPages={data.totalPages}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            ) : null}
          </>
        )}
      </section>

      <MoveDepartmentDialog
        open={moveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
        departments={departments ?? []}
        count={moveTarget?.length ?? 0}
        isPending={isPending}
        onConfirm={handleMove}
      />

      <ConfirmDialog
        open={terminateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setTerminateTarget(null);
        }}
        title="Đánh dấu nhân viên đã nghỉ việc?"
        description={
          terminateTarget ? (
            <>
              <span className="font-medium text-ink">
                {terminateTarget.fullName}
              </span>{" "}
              sẽ chuyển sang trạng thái “Đã nghỉ việc” và không còn xuất hiện
              trong danh sách chấm công hằng ngày.
            </>
          ) : undefined
        }
        confirmLabel="Đánh dấu nghỉ việc"
        tone="destructive"
        isPending={isPending}
        onConfirm={handleTerminate}
      />
    </div>
  );
}
