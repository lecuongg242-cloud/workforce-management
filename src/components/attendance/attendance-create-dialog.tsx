"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ATTENDANCE_EDIT_LABELS } from "@/lib/constants";
import { createAttendanceRecord } from "@/lib/data/mutations/attendance";
import {
  createAttendanceSchema,
  type CreateAttendanceFormValues,
} from "@/lib/validation/schemas";
import type { Employee, Shift } from "@/lib/types/domain";

/**
 * Quan tri them mot luot cham cong cho ngay nhan vien quen bam han
 * (spec 2026-09-06).
 *
 * Ca duoc DE SAN theo ca hien tai cua nhan vien duoc chon, nhung van doi duoc:
 * mot ngay cu co the thuoc ca cu, va doi ca khong sua lich su.
 */
export function AttendanceCreateDialog({
  employees,
  shifts,
  defaultDate,
  open,
  onOpenChange,
  onCreated,
}: {
  employees: Employee[];
  shifts: Shift[];
  /** "YYYY-MM-DD" — ngay hom nay theo dong ho may chu. */
  defaultDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}): React.ReactElement {
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateAttendanceFormValues>({
    resolver: zodResolver(createAttendanceSchema),
    defaultValues: {
      employeeId: "",
      date: defaultDate,
      shiftId: "",
      checkIn: "",
      checkOut: "",
    },
  });

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      reset({
        employeeId: "",
        date: defaultDate,
        shiftId: "",
        checkIn: "",
        checkOut: "",
      });
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createAttendanceRecord({
        employeeId: values.employeeId,
        date: values.date,
        shiftId: values.shiftId,
        checkIn: values.checkIn,
        checkOut: (values.checkOut as string | null) ?? null,
      });
      toast.success(ATTENDANCE_EDIT_LABELS.createSuccessToast);
      onCreated();
      handleOpenChange(false);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : ATTENDANCE_EDIT_LABELS.createError,
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ATTENDANCE_EDIT_LABELS.createTitle}</DialogTitle>
          <DialogDescription>
            {ATTENDANCE_EDIT_LABELS.createDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {submitError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-control border border-danger-border bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}

          <Controller
            control={control}
            name="employeeId"
            render={({ field }) => (
              <Field
                id="createEmployeeId"
                label={ATTENDANCE_EDIT_LABELS.employeeLabel}
                error={errors.employeeId?.message}
                required
              >
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    // De san ca hien tai cua nguoi vua chon — van doi duoc.
                    const picked = employees.find((item) => item.id === value);
                    if (picked) setValue("shiftId", picked.shiftId);
                  }}
                >
                  <SelectTrigger id="createEmployeeId" className="w-full">
                    <SelectValue placeholder="Chọn nhân viên" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.fullName} · {employee.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="createDate"
              label={ATTENDANCE_EDIT_LABELS.dateLabel}
              error={errors.date?.message}
              required
            >
              <Input type="date" className="num" {...register("date")} />
            </Field>

            <Controller
              control={control}
              name="shiftId"
              render={({ field }) => (
                <Field
                  id="createShiftId"
                  label={ATTENDANCE_EDIT_LABELS.shiftLabel}
                  error={errors.shiftId?.message}
                  required
                >
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="createShiftId" className="w-full">
                      <SelectValue placeholder="Chọn ca" />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map((shift) => (
                        <SelectItem key={shift.id} value={shift.id}>
                          {shift.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="createCheckIn"
              label={ATTENDANCE_EDIT_LABELS.checkInLabel}
              error={errors.checkIn?.message}
              required
            >
              <Input type="time" className="num" {...register("checkIn")} />
            </Field>

            <Field
              id="createCheckOut"
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
                  {ATTENDANCE_EDIT_LABELS.createPending}
                </>
              ) : (
                ATTENDANCE_EDIT_LABELS.createIdle
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
