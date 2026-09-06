"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ATTENDANCE_EDIT_LABELS } from "@/lib/constants";
import { updateAttendanceRecord } from "@/lib/data/mutations/attendance";
import { formatDate } from "@/lib/format";
import {
  attendanceTimesSchema,
  type AttendanceTimesFormValues,
} from "@/lib/validation/schemas";
import type { AttendanceRecord } from "@/lib/types/domain";

/**
 * Quan tri sua gio vao/ra cua mot luot cham cong (spec 2026-09-06).
 *
 * Hien ro NHAN VIEN, NGAY CONG va CA ngay trong hop thoai: day la thao tac
 * doi mot con so se thanh tien luong, nguoi bam phai nhin thay minh dang sua
 * cua ai va cua ngay nao truoc khi go.
 *
 * Ngay cong khong sua duoc o day — xem chu thich cua `updateAttendanceRecord`.
 */
export function AttendanceEditDialog({
  record,
  employeeName,
  shiftName,
  open,
  onOpenChange,
  onSaved,
}: {
  record: AttendanceRecord | null;
  employeeName: string;
  shiftName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}): React.ReactElement {
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AttendanceTimesFormValues>({
    resolver: zodResolver(attendanceTimesSchema),
    defaultValues: { checkIn: "", checkOut: "" },
  });

  /**
   * Nap lai gia tri moi khi doi sang mot ban ghi khac. `reset` trong effect
   * chu khong `defaultValues`: hop thoai duoc dung lai cho moi dong cua bang,
   * ma `defaultValues` chi doc mot lan luc mount.
   */
  React.useEffect(() => {
    if (record && open) {
      reset({ checkIn: record.checkIn ?? "", checkOut: record.checkOut ?? "" });
      setSubmitError(null);
    }
  }, [record, open, reset]);

  const handleOpenChange = (next: boolean): void => {
    if (!next) setSubmitError(null);
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!record) return;
    setSubmitError(null);
    try {
      // `values` da qua transform cua schema: chuoi rong -> null.
      await updateAttendanceRecord(record.id, {
        checkIn: values.checkIn,
        checkOut: (values.checkOut as string | null) ?? null,
      });
      toast.success(ATTENDANCE_EDIT_LABELS.editSuccessToast);
      onSaved();
      handleOpenChange(false);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : ATTENDANCE_EDIT_LABELS.editError,
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ATTENDANCE_EDIT_LABELS.editTitle}</DialogTitle>
          <DialogDescription>
            {ATTENDANCE_EDIT_LABELS.editDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="rounded-control border border-hairline bg-canvas-soft px-3 py-2.5">
            <p className="text-sm font-medium text-ink">{employeeName}</p>
            <p className="num text-[13px] text-ink-secondary">
              {record ? formatDate(record.date) : "—"} · {shiftName}
            </p>
          </div>

          {submitError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-control border border-danger-border bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="editCheckIn"
              label={ATTENDANCE_EDIT_LABELS.checkInLabel}
              error={errors.checkIn?.message}
              required
            >
              <Input type="time" className="num" {...register("checkIn")} />
            </Field>

            <Field
              id="editCheckOut"
              label={ATTENDANCE_EDIT_LABELS.checkOutLabel}
              error={errors.checkOut?.message}
              hint={ATTENDANCE_EDIT_LABELS.checkOutHint}
            >
              <Input type="time" className="num" {...register("checkOut")} />
            </Field>
          </div>

          <p className="text-xs text-ink-muted">
            {ATTENDANCE_EDIT_LABELS.overnightHint}
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {ATTENDANCE_EDIT_LABELS.cancelButton}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  {ATTENDANCE_EDIT_LABELS.savePending}
                </>
              ) : (
                ATTENDANCE_EDIT_LABELS.saveIdle
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
