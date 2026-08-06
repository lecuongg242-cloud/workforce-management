"use client";

import * as React from "react";
import { MinusCircle, Plus, PlusCircle, Power, Wallet } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PayAdjustmentDialog } from "@/components/settings/pay-adjustment-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  PAY_ADJUSTMENT_BASIS_LABEL,
  PAY_ADJUSTMENT_LABEL,
} from "@/lib/constants";
import { listDepartments } from "@/lib/data/departments";
import { listAllEmployees } from "@/lib/data/employees";
import {
  createPayAdjustment,
  deactivatePayAdjustment,
  listPayAdjustments,
  updatePayAdjustment,
} from "@/lib/data/pay-adjustments";
import { useDataStore } from "@/lib/data/store";
import { formatNumber, formatVnd } from "@/lib/format";
import { describeScopes, resolveTargets } from "@/lib/payroll/scope";
import type { PayAdjustment, PayAdjustmentInput } from "@/lib/types/domain";

/**
 * Tab "Phu cap & khau tru" cua `/admin/settings` (PAY-04, plan 05-2-03).
 *
 * KHONG CO NUT XOA o day, va man hinh noi ro vi sao (`noDeleteNote`): mot
 * khoan da tung vao mot bang luong da chot la phan giai thich "vi sao ra con
 * so do". Tat khoan de ngung ap dung; du lieu o lai.
 *
 * Cot "So nguoi bi ap" tinh bang CHINH `resolveTargets()` ma phep tinh luong
 * dung — mot con so o day khac voi con so luc tinh tien la mot loi khong ai
 * phat hien ra cho toi khi tien da tra.
 */
export function PayAdjustmentsTab(): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PayAdjustment | null>(null);

  const { data, isLoading, error, reload } = useDataQuery(async () => {
    const [adjustments, employees, departments] = await Promise.all([
      listPayAdjustments(),
      listAllEmployees(session.companyId),
      listDepartments(session.companyId),
    ]);
    return { adjustments, employees, departments };
  }, [session.companyId]);

  const handleSubmit = async (values: PayAdjustmentInput): Promise<void> => {
    if (editing) {
      await updatePayAdjustment(editing.id, values);
    } else {
      await createPayAdjustment(values);
    }
    toast.success(PAY_ADJUSTMENT_LABEL.saveSuccess);
    invalidate();
    reload();
    setDialogOpen(false);
    setEditing(null);
  };

  const handleToggle = async (
    adjustment: PayAdjustment,
  ): Promise<void> => {
    try {
      await deactivatePayAdjustment(adjustment.id, !adjustment.isActive);
      toast.success(PAY_ADJUSTMENT_LABEL.toggleSuccess);
      invalidate();
      reload();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : PAY_ADJUSTMENT_LABEL.saveError,
      );
    }
  };

  const scopeEmployees = React.useMemo(
    () =>
      (data?.employees ?? []).map((employee) => ({
        id: employee.id,
        departmentId: employee.departmentId,
        position: employee.position,
      })),
    [data],
  );

  const departmentNameById = React.useMemo(
    () => new Map((data?.departments ?? []).map((item) => [item.id, item.name])),
    [data],
  );
  const employeeNameById = React.useMemo(
    () => new Map((data?.employees ?? []).map((item) => [item.id, item.fullName])),
    [data],
  );

  const scopeLabels = React.useMemo(
    () => ({
      company: "Toàn công ty",
      department: (value: string) =>
        `Phòng ${departmentNameById.get(value) ?? value}`,
      position: (value: string) => `Chức vụ “${value}”`,
      employee: (value: string) => employeeNameById.get(value) ?? value,
      excludeSuffix: (count: number) =>
        PAY_ADJUSTMENT_LABEL.scopeExcludeSuffix.replace("{n}", String(count)),
      none: PAY_ADJUSTMENT_LABEL.scopeNone,
    }),
    [departmentNameById, employeeNameById],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">
            {PAY_ADJUSTMENT_LABEL.sectionTitle}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {PAY_ADJUSTMENT_LABEL.sectionDescription}
          </p>
          {/* D-40a: gioi han noi thang ngay tai noi khai. */}
          <p className="mt-2 text-xs text-ink-muted">
            {PAY_ADJUSTMENT_LABEL.perPeriodOnlyNote}
          </p>
          {/* Vi sao khong co nut xoa — noi ngay tai cho. */}
          <p className="mt-2 text-xs text-ink-muted">
            {PAY_ADJUSTMENT_LABEL.noDeleteNote}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {PAY_ADJUSTMENT_LABEL.addAction}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : (data?.adjustments ?? []).length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={PAY_ADJUSTMENT_LABEL.emptyTitle}
          description={PAY_ADJUSTMENT_LABEL.emptyBody}
          compact
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{PAY_ADJUSTMENT_LABEL.columnName}</TableHead>
                <TableHead>{PAY_ADJUSTMENT_LABEL.columnKind}</TableHead>
                <TableHead className="text-right">
                  {PAY_ADJUSTMENT_LABEL.columnValue}
                </TableHead>
                <TableHead>{PAY_ADJUSTMENT_LABEL.columnBasis}</TableHead>
                <TableHead>{PAY_ADJUSTMENT_LABEL.columnScope}</TableHead>
                <TableHead className="text-right">
                  {PAY_ADJUSTMENT_LABEL.columnTargets}
                </TableHead>
                <TableHead>{PAY_ADJUSTMENT_LABEL.columnStatus}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.adjustments ?? []).map((adjustment) => {
                const targets = resolveTargets({
                  employees: scopeEmployees,
                  scopes: adjustment.scopes,
                });
                const isAllowance = adjustment.kind === "allowance";
                return (
                  <TableRow key={adjustment.id}>
                    <TableCell className="font-medium text-ink">
                      {adjustment.name}
                    </TableCell>
                    <TableCell>
                      {/* Phan biet bang BIEU TUONG cong NHAN CHU, khong bang
                          mau don thuan (UI-SPEC: status never color-only). */}
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-secondary">
                        {isAllowance ? (
                          <PlusCircle
                            aria-hidden="true"
                            className="size-3.5 text-success"
                          />
                        ) : (
                          <MinusCircle
                            aria-hidden="true"
                            className="size-3.5 text-danger"
                          />
                        )}
                        {isAllowance ? "Phụ cấp" : "Khấu trừ"}
                      </span>
                    </TableCell>
                    <TableCell className="num text-right font-medium text-ink">
                      {adjustment.valueType === "fixed_amount"
                        ? formatVnd(adjustment.value)
                        : `${formatNumber(adjustment.value)}% lương ngày`}
                    </TableCell>
                    <TableCell className="text-ink-secondary">
                      {PAY_ADJUSTMENT_BASIS_LABEL[adjustment.basis]}
                    </TableCell>
                    <TableCell className="text-ink-secondary">
                      {describeScopes({
                        scopes: adjustment.scopes,
                        labels: scopeLabels,
                      })}
                    </TableCell>
                    <TableCell className="num text-right text-ink-secondary">
                      {formatNumber(targets.length)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          adjustment.isActive
                            ? "text-[13px] text-ink-secondary"
                            : "text-[13px] text-ink-muted"
                        }
                      >
                        {adjustment.isActive
                          ? PAY_ADJUSTMENT_LABEL.statusActive
                          : PAY_ADJUSTMENT_LABEL.statusInactive}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(adjustment);
                            setDialogOpen(true);
                          }}
                        >
                          {PAY_ADJUSTMENT_LABEL.editAction}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(adjustment)}
                        >
                          <Power className="size-4" aria-hidden="true" />
                          {adjustment.isActive
                            ? PAY_ADJUSTMENT_LABEL.deactivateAction
                            : PAY_ADJUSTMENT_LABEL.activateAction}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PayAdjustmentDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        adjustment={editing}
        employees={data?.employees ?? []}
        departments={data?.departments ?? []}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
