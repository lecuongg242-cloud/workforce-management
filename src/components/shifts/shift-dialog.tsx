"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MoonStar } from "lucide-react";

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
import { WEEKDAY_OPTIONS } from "@/lib/constants";
import {
  breakWindowMinutes,
  formatDuration,
  isOvernight,
  minutesBetween,
} from "@/lib/format";
import type { Shift, ShiftStatus, WeekdayNumber } from "@/lib/types/domain";
import { shiftSchema, type ShiftFormValues } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

/**
 * Hop thoai tao / sua ca lam viec.
 * Tu dong nhan dien ca qua ngay khi gio ket thuc nho hon hoac bang gio bat dau.
 */
export function ShiftDialog({
  open,
  onOpenChange,
  shift,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift | null;
  onSubmit: (values: ShiftFormValues, overnight: boolean) => Promise<void>;
}): React.ReactElement {
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      name: "",
      code: "",
      startTime: "08:00",
      endTime: "17:30",
      breakStartTime: "12:00",
      breakEndTime: "13:00",
      lateToleranceMinutes: 5,
      workingDays: [1, 2, 3, 4, 5],
      status: "active",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    reset(
      shift
        ? {
            name: shift.name,
            code: shift.code,
            startTime: shift.startTime,
            endTime: shift.endTime,
            // Ca tao truoc migration 0025 chua co khung gio -> de trong, va
            // cau nhac ben duoi noi ro no dang tru bao nhieu phut theo cach cu.
            breakStartTime: shift.breakStartTime ?? "",
            breakEndTime: shift.breakEndTime ?? "",
            lateToleranceMinutes: shift.lateToleranceMinutes,
            workingDays: shift.workingDays,
            status: shift.status,
          }
        : {
            name: "",
            code: "",
            startTime: "08:00",
            endTime: "17:30",
            breakStartTime: "12:00",
            breakEndTime: "13:00",
            lateToleranceMinutes: 5,
            workingDays: [1, 2, 3, 4, 5],
            status: "active",
          },
    );
  }, [open, shift, reset]);

  const startTime = watch("startTime");
  const endTime = watch("endTime");
  const breakStartTime = watch("breakStartTime");
  const breakEndTime = watch("breakEndTime");
  const workingDays = watch("workingDays");

  const overnight = isOvernight(startTime, endTime);
  // Ca cu (co so phut nghi nhung chua khai khung gio) van tinh theo con so cu
  // cho toi khi nguoi dung khai khung gio — man hinh khong tu bia mot khung
  // gio ma he thong khong biet.
  const legacyBreakMinutes =
    shift && !shift.breakStartTime ? shift.breakMinutes : 0;
  const breakMinutes =
    breakStartTime && breakEndTime
      ? breakWindowMinutes(breakStartTime, breakEndTime)
      : legacyBreakMinutes;
  const workingMinutes = Math.max(
    minutesBetween(startTime, endTime) - breakMinutes,
    0,
  );

  const toggleDay = (day: WeekdayNumber): void => {
    const next = workingDays.includes(day)
      ? workingDays.filter((item) => item !== day)
      : [...workingDays, day].sort((a, b) => a - b);
    setValue("workingDays", next, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{shift ? "Chỉnh sửa ca làm việc" : "Tạo ca làm việc"}</DialogTitle>
          <DialogDescription>
            Ca kết thúc vào ngày hôm sau sẽ được tự động đánh dấu là ca qua đêm.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values, isOvernight(values.startTime, values.endTime));
          })}
          noValidate
          className="grid gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="shift-form-name"
              label="Tên ca"
              error={errors.name?.message}
              required
            >
              <Input placeholder="Ca hành chính" {...register("name")} />
            </Field>

            <Field
              id="shift-form-code"
              label="Mã ca"
              error={errors.code?.message}
              required
            >
              <Input className="num uppercase" placeholder="HC" {...register("code")} />
            </Field>

            <Field
              id="shift-form-start"
              label="Giờ bắt đầu"
              error={errors.startTime?.message}
              required
            >
              <Input type="time" className="num" {...register("startTime")} />
            </Field>

            <Field
              id="shift-form-end"
              label="Giờ kết thúc"
              error={errors.endTime?.message}
              required
            >
              <Input type="time" className="num" {...register("endTime")} />
            </Field>

            <Field
              id="shift-form-break-start"
              label="Giờ nghỉ"
              error={errors.breakStartTime?.message}
              hint="Để trống nếu ca không có giờ nghỉ."
            >
              <Input type="time" className="num" {...register("breakStartTime")} />
            </Field>

            <Field
              id="shift-form-break-end"
              label="Kết thúc giờ nghỉ"
              error={errors.breakEndTime?.message}
            >
              <Input type="time" className="num" {...register("breakEndTime")} />
            </Field>

            <Field
              id="shift-form-late"
              label="Cho phép đi muộn (phút)"
              error={errors.lateToleranceMinutes?.message}
              required
            >
              <Input
                type="number"
                min={0}
                max={60}
                className="num"
                {...register("lateToleranceMinutes", { valueAsNumber: true })}
              />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink-secondary">
              Ngày áp dụng trong tuần
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((option) => {
                const selected = workingDays.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDay(option.value)}
                    className={cn(
                      "min-h-10 min-w-10 rounded-full border px-3 text-sm font-medium transition-colors",
                      selected
                        ? "border-brand bg-brand text-white"
                        : "border-hairline bg-white text-ink-secondary hover:bg-canvas-soft",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {errors.workingDays ? (
              <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                {errors.workingDays.message}
              </p>
            ) : null}
          </fieldset>

          <Field id="shift-form-status" label="Trạng thái" required>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as ShiftStatus)}
                >
                  <SelectTrigger id="shift-form-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Đang áp dụng</SelectItem>
                    <SelectItem value="archived">Ngừng sử dụng</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {/* Tom tat tinh toan — giup nguoi dung thay ngay ca qua dem */}
          <div className="rounded-control border border-hairline bg-canvas-soft px-4 py-3">
            <p className="text-[13px] text-ink-secondary">
              Thời gian làm việc thực tế:{" "}
              <span className="num font-medium text-ink">
                {formatDuration(workingMinutes)}
              </span>
              {breakMinutes > 0 ? (
                <>
                  {" "}
                  <span className="text-ink-muted">
                    (đã trừ {formatDuration(breakMinutes)} nghỉ)
                  </span>
                </>
              ) : null}
            </p>

            {/* Ca khai theo cach cu: noi ro he thong dang tru theo con so nao
                va vi sao nen khai khung gio — khong tu bia mot khung gio. */}
            {legacyBreakMinutes > 0 && !(breakStartTime && breakEndTime) ? (
              <p className="mt-1.5 text-[13px] text-warning">
                Ca này đang khai {formatDuration(legacyBreakMinutes)} nghỉ theo
                cách cũ, chưa có khung giờ. Chọn giờ nghỉ để nhân viên biết nghỉ
                lúc mấy giờ — số phút trừ vào công vẫn tính theo khung giờ bạn
                chọn.
              </p>
            ) : null}
            {overnight ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-info">
                <MoonStar aria-hidden="true" className="size-3.5" />
                Ca qua đêm — kết thúc lúc {endTime} ngày hôm sau.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  Đang lưu…
                </>
              ) : shift ? (
                "Lưu thay đổi"
              ) : (
                "Tạo ca làm việc"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
