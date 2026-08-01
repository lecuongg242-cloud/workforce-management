"use client";

import * as React from "react";
import { MoreHorizontal, Network, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CardListSkeleton } from "@/components/common/data-table-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { DepartmentDialog } from "@/components/departments/department-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { formatNumber } from "@/lib/format";
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
  type DepartmentWithStats,
} from "@/lib/data/departments";
import { listAllEmployees } from "@/lib/data/employees";
import { useDataStore } from "@/lib/data/store";
import type { Department } from "@/lib/types/domain";
import type { DepartmentFormValues } from "@/lib/validation/schemas";

export function DepartmentsView(): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<DepartmentWithStats | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const { data, isLoading, error, reload } = useDataQuery(
    async () => {
      const [departments, employees] = await Promise.all([
        listDepartments(session.companyId),
        listAllEmployees(session.companyId),
      ]);
      return { departments, employees };
    },
    [session.companyId],
  );

  const departments = data?.departments ?? [];

  const handleSubmit = async (values: DepartmentFormValues): Promise<void> => {
    try {
      if (editing) {
        await updateDepartment(editing.id, values);
        toast.success(`Đã cập nhật phòng ban ${values.name}.`);
      } else {
        await createDepartment(session.companyId, values);
        toast.success(`Đã thêm phòng ban ${values.name}.`);
      }
      invalidate();
      setDialogOpen(false);
      setEditing(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không lưu được phòng ban.",
      );
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setIsPending(true);
    try {
      await deleteDepartment(deleteTarget.id);
      invalidate();
      toast.success(`Đã xóa phòng ban ${deleteTarget.name}.`);
      setDeleteTarget(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không xóa được phòng ban.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const totalEmployees = departments.reduce(
    (sum, department) => sum + department.employeeCount,
    0,
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Phòng ban"
        description={
          data ? (
            <>
              <span className="num font-medium text-ink">
                {formatNumber(departments.length)}
              </span>{" "}
              phòng ban đang quản lý{" "}
              <span className="num font-medium text-ink">
                {formatNumber(totalEmployees)}
              </span>{" "}
              nhân viên.
            </>
          ) : (
            "Đang tải danh sách phòng ban…"
          )
        }
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            Thêm phòng ban
          </Button>
        }
      />

      <section className="surface-card overflow-hidden">
        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading ? (
          <div className="p-4">
            <CardListSkeleton items={5} />
          </div>
        ) : departments.length === 0 ? (
          <EmptyState
            icon={Network}
            title="Chưa có phòng ban nào"
            description="Tạo phòng ban để phân nhóm nhân viên và giao quyền quản lý."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus aria-hidden="true" />
                Thêm phòng ban
              </Button>
            }
          />
        ) : (
          <>
            {/* Bang cho man hinh rong */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên phòng ban</TableHead>
                    <TableHead>Quản lý</TableHead>
                    <TableHead>Số nhân viên</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-12 text-right">
                      <span className="sr-only">Hành động</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((department) => (
                    <TableRow key={department.id}>
                      <TableCell>
                        <span className="block font-medium text-ink">
                          {department.name}
                        </span>
                        <span className="block max-w-[420px] truncate text-xs text-ink-muted">
                          {department.description || "Chưa có mô tả"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {department.managerName ?? (
                          <span className="text-ink-muted">Chưa phân công</span>
                        )}
                      </TableCell>
                      <TableCell className="num">
                        {formatNumber(department.employeeCount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          kind="department"
                          value={department.status}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <RowMenu
                          name={department.name}
                          onEdit={() => {
                            setEditing(department);
                            setDialogOpen(true);
                          }}
                          onDelete={() => setDeleteTarget(department)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* The cho dien thoai */}
            <ul className="grid gap-2.5 p-3 md:hidden">
              {departments.map((department) => (
                <li
                  key={department.id}
                  className="rounded-control border border-hairline p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{department.name}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {department.managerName ?? "Chưa phân công quản lý"}
                      </p>
                    </div>
                    <RowMenu
                      name={department.name}
                      onEdit={() => {
                        setEditing(department);
                        setDialogOpen(true);
                      }}
                      onDelete={() => setDeleteTarget(department)}
                    />
                  </div>
                  <p className="mt-2 text-[13px] text-ink-secondary">
                    {department.description || "Chưa có mô tả"}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="num rounded-full bg-canvas-soft px-2 py-0.5 text-[11px] text-ink-secondary">
                      {formatNumber(department.employeeCount)} nhân viên
                    </span>
                    <StatusBadge
                      kind="department"
                      value={department.status}
                      size="sm"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <DepartmentDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        department={editing}
        employees={data?.employees ?? []}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Xóa phòng ban ${deleteTarget?.name ?? ""}?`}
        description={
          deleteTarget && deleteTarget.employeeCount > 0 ? (
            <>
              Phòng ban này đang có{" "}
              <span className="num font-medium text-ink">
                {formatNumber(deleteTarget.employeeCount)}
              </span>{" "}
              nhân viên. Sau khi xóa, bạn cần chuyển họ sang phòng ban khác.
            </>
          ) : (
            "Hành động này không thể hoàn tác."
          )
        }
        confirmLabel="Xóa phòng ban"
        tone="destructive"
        isPending={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function RowMenu({
  name,
  onEdit,
  onDelete,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Hành động cho phòng ban ${name}`}
        className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-canvas-soft hover:text-ink"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden="true" />
          Chỉnh sửa
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 aria-hidden="true" />
          Xóa phòng ban
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
