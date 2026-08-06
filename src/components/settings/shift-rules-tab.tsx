"use client";

import * as React from "react";
import { MoonStar } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ShiftDialog } from "@/components/shifts/shift-dialog";
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
import { SETTINGS_SHIFT_LABEL } from "@/lib/constants";
import { listShifts, updateShift, type ShiftWithStats } from "@/lib/data/shifts";
import { useDataStore } from "@/lib/data/store";
import { formatNumber } from "@/lib/format";
import type { ShiftFormValues } from "@/lib/validation/schemas";

/**
 * Tab "Ca lam viec" cua `/admin/settings` (SET-01, plan 04-02).
 *
 * Gio lam chuan va an han di muon la thuoc tinh cua TUNG CA (mot doanh nghiep
 * co nhieu ca), khong phai mot gia tri chung o cap doanh nghiep — vi vay chung
 * o bang `shifts` chu khong o `company_settings`.
 *
 * Tab nay KHONG mo duong ghi thu hai: no dung lai DUNG `ShiftDialog` va DUNG
 * Server Action `updateShift()` ma `/admin/shifts` dang dung. Hai bo quy tac
 * kiem tra song song vao cung mot bang se lech nhau — va o day chung quyet
 * dinh ai bi tinh di muon.
 */
export function ShiftRulesTab(): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const [editing, setEditing] = React.useState<ShiftWithStats | null>(null);

  const { data: shifts, isLoading, error, reload } = useDataQuery(
    () => listShifts(session.companyId),
    [session.companyId],
  );

  // Ca da luu tru khong hien: quy tac cua mot ca khong con dung khong phai thu
  // can khai lai.
  const activeShifts = shifts?.filter((shift) => shift.status === "active") ?? [];

  const handleSubmit = async (
    values: ShiftFormValues,
    overnight: boolean,
  ): Promise<void> => {
    if (!editing) return;
    try {
      await updateShift(editing.id, {
        ...values,
        code: values.code.toUpperCase(),
        overnight,
      });
      toast.success(`Đã cập nhật ${values.name}.`);
      invalidate();
      reload();
      setEditing(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : SETTINGS_SHIFT_LABEL.saveError,
      );
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink">
          {SETTINGS_SHIFT_LABEL.sectionTitle}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {SETTINGS_SHIFT_LABEL.sectionDescription}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : activeShifts.length === 0 ? (
        <EmptyState
          title={SETTINGS_SHIFT_LABEL.emptyTitle}
          description={SETTINGS_SHIFT_LABEL.emptyBody}
          action={
            <Button asChild variant="outline">
              <a href="/admin/shifts">{SETTINGS_SHIFT_LABEL.emptyAction}</a>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{SETTINGS_SHIFT_LABEL.columnShift}</TableHead>
                <TableHead>{SETTINGS_SHIFT_LABEL.columnHours}</TableHead>
                <TableHead>{SETTINGS_SHIFT_LABEL.columnTolerance}</TableHead>
                <TableHead>{SETTINGS_SHIFT_LABEL.columnEmployees}</TableHead>
                <TableHead className="text-right">
                  {SETTINGS_SHIFT_LABEL.columnAction}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeShifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>
                    <span className="font-medium text-ink">{shift.name}</span>
                    <span className="num ml-2 text-xs text-ink-muted">
                      {shift.code}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="num">
                      {shift.startTime} – {shift.endTime}
                    </span>
                    {/* `overnight` la COT SINH cua database, chi doc lai —
                        khong bao gio tinh lai o tang ung dung (02-06). */}
                    {shift.overnight ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-muted">
                        <MoonStar className="size-3.5" aria-hidden="true" />
                        {SETTINGS_SHIFT_LABEL.overnightTag}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="num">
                    {shift.lateToleranceMinutes === 0
                      ? SETTINGS_SHIFT_LABEL.noTolerance
                      : `${formatNumber(shift.lateToleranceMinutes)} phút`}
                  </TableCell>
                  <TableCell className="num">
                    {formatNumber(shift.employeeCount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(shift)}
                    >
                      {SETTINGS_SHIFT_LABEL.editAction}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ShiftDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        shift={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
