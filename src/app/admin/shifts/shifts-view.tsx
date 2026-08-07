"use client";

import * as React from "react";
import { CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ShiftCard } from "@/components/shifts/shift-card";
import { ShiftDialog } from "@/components/shifts/shift-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { formatNumber } from "@/lib/format";
import { hoursToMinutes } from "@/lib/shifts/schedule";
import {
  createShift,
  duplicateShift,
  listShifts,
  updateShift,
  type ShiftWithStats,
} from "@/lib/data/shifts";
import { useDataStore } from "@/lib/data/store";
import type { Shift, ShiftInput } from "@/lib/types/domain";
import type { ShiftFormValues } from "@/lib/validation/schemas";

export function ShiftsView(): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Shift | null>(null);
  const [archiveTarget, setArchiveTarget] =
    React.useState<ShiftWithStats | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const { data: shifts, isLoading, error, reload } = useDataQuery(
    () => listShifts(session.companyId),
    [session.companyId],
  );

  const handleSubmit = async (
    values: ShiftFormValues,
    overnight: boolean,
  ): Promise<void> => {
    try {
      // Hai hinh dang tach han nhau (migration 0027): ca linh hoat KHONG gui
      // gio vao/gio ra hay khung gio nghi len duong ghi. Gui kem chung se bi
      // `shifts_shape_check` cua database tu choi — va lam vay cung se luu mot
      // gio moc cho mot ca ma dinh nghia cua no la khong co gio moc.
      const payload: ShiftInput =
        values.kind === "hours"
          ? {
              kind: "hours",
              name: values.name,
              code: values.code.toUpperCase(),
              startTime: null,
              endTime: null,
              durationMinutes: hoursToMinutes(values.durationHours),
              breakStartTime: null,
              breakEndTime: null,
              lateToleranceMinutes: 0,
              workingDays: values.workingDays,
              status: values.status,
              overnight: false,
            }
          : {
              kind: "fixed",
              name: values.name,
              code: values.code.toUpperCase(),
              startTime: values.startTime,
              endTime: values.endTime,
              durationMinutes: null,
              // O `<input type="time">` de trong tra ve chuoi rong; database va
              // domain dung `null` cho "ca khong co gio nghi".
              breakStartTime: values.breakStartTime || null,
              breakEndTime: values.breakEndTime || null,
              lateToleranceMinutes: values.lateToleranceMinutes,
              workingDays: values.workingDays,
              status: values.status,
              overnight,
            };
      if (editing) {
        await updateShift(editing.id, payload);
        toast.success(`Đã cập nhật ${values.name}.`);
      } else {
        await createShift(session.companyId, payload);
        toast.success(`Đã tạo ${values.name}.`, {
          description: overnight ? "Ca này được đánh dấu là ca qua đêm." : undefined,
        });
      }
      invalidate();
      setDialogOpen(false);
      setEditing(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không lưu được ca làm việc.",
      );
    }
  };

  const handleDuplicate = async (shift: ShiftWithStats): Promise<void> => {
    try {
      const copy = await duplicateShift(shift.id);
      invalidate();
      toast.success(`Đã nhân bản thành ${copy.name}.`);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không nhân bản được ca làm việc.",
      );
    }
  };

  const handleArchive = async (): Promise<void> => {
    if (!archiveTarget) return;
    setIsPending(true);
    try {
      await updateShift(archiveTarget.id, { status: "archived" });
      invalidate();
      toast.success(`Đã ngừng sử dụng ${archiveTarget.name}.`);
      setArchiveTarget(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không cập nhật được ca làm việc.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const activeShifts = shifts?.filter((shift) => shift.status === "active") ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Ca làm việc"
        description={
          shifts ? (
            <>
              <span className="num font-medium text-ink">
                {formatNumber(activeShifts.length)}
              </span>{" "}
              ca đang áp dụng trên tổng số{" "}
              <span className="num font-medium text-ink">
                {formatNumber(shifts.length)}
              </span>{" "}
              ca đã tạo.
            </>
          ) : (
            "Đang tải danh sách ca làm việc…"
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
            Tạo ca làm việc
          </Button>
        }
      />

      {error ? (
        <div className="surface-card">
          <ErrorState description={error} onRetry={reload} />
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-card" />
          ))}
        </div>
      ) : !shifts || shifts.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={CalendarClock}
            title="Chưa có ca làm việc nào"
            description="Tạo ca đầu tiên để hệ thống biết cách tính giờ vào, giờ ra và đi muộn."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus aria-hidden="true" />
                Tạo ca làm việc
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              onEdit={(item) => {
                setEditing(item);
                setDialogOpen(true);
              }}
              onDuplicate={handleDuplicate}
              onArchive={setArchiveTarget}
            />
          ))}
        </div>
      )}

      <ShiftDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        shift={editing}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title={`Ngừng sử dụng ${archiveTarget?.name ?? ""}?`}
        description={
          archiveTarget && archiveTarget.employeeCount > 0 ? (
            <>
              Đang có{" "}
              <span className="num font-medium text-ink">
                {formatNumber(archiveTarget.employeeCount)}
              </span>{" "}
              nhân viên áp dụng ca này. Hãy chuyển họ sang ca khác trước khi
              ngừng sử dụng.
            </>
          ) : (
            "Ca này sẽ không còn được chọn khi thêm nhân viên mới."
          )
        }
        confirmLabel="Ngừng sử dụng"
        tone="destructive"
        isPending={isPending}
        onConfirm={handleArchive}
      />
    </div>
  );
}
