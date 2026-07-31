"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { REFERENCE_DATE, REQUEST_TYPE_OPTIONS } from "@/lib/constants";
import type { RequestType } from "@/lib/types/domain";
import {
  workRequestSchema,
  type WorkRequestFormValues,
} from "@/lib/validation/schemas";

/**
 * Bieu mau tao yeu cau, mo tu duoi len (bottom sheet) cho phu hop voi
 * thao tac mot tay tren dien thoai.
 */
export function RequestFormSheet({
  open,
  onOpenChange,
  defaultType,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: RequestType;
  onSubmit: (values: WorkRequestFormValues) => Promise<void>;
}): React.ReactElement {
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WorkRequestFormValues>({
    resolver: zodResolver(workRequestSchema),
    defaultValues: {
      type: defaultType ?? "leave",
      fromDate: REFERENCE_DATE,
      toDate: REFERENCE_DATE,
      fromTime: null,
      toTime: null,
      reason: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    reset({
      type: defaultType ?? "leave",
      fromDate: REFERENCE_DATE,
      toDate: REFERENCE_DATE,
      fromTime: defaultType && defaultType !== "leave" ? "08:00" : null,
      toTime: defaultType && defaultType !== "leave" ? "17:30" : null,
      reason: "",
    });
  }, [open, defaultType, reset]);

  const type = watch("type");
  const needsTime = type !== "leave";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="safe-bottom mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-panel"
      >
        <SheetHeader>
          <SheetTitle>Tạo yêu cầu</SheetTitle>
          <SheetDescription>
            Yêu cầu sẽ được gửi tới quản lý trực tiếp để duyệt.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
          })}
          noValidate
          className="grid gap-4 px-4 pb-6"
        >
          <Field
            id="request-type"
            label="Loại yêu cầu"
            error={errors.type?.message}
            required
          >
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as RequestType)}
                >
                  <SelectTrigger id="request-type" className="h-11 w-full">
                    <SelectValue placeholder="Chọn loại yêu cầu" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              id="request-from-date"
              label="Từ ngày"
              error={errors.fromDate?.message}
              required
            >
              <Input type="date" className="num h-11" {...register("fromDate")} />
            </Field>
            <Field
              id="request-to-date"
              label="Đến ngày"
              error={errors.toDate?.message}
              required
            >
              <Input type="date" className="num h-11" {...register("toDate")} />
            </Field>
          </div>

          {needsTime ? (
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="request-from-time"
                label="Từ giờ"
                error={errors.fromTime?.message}
                required
              >
                <Input
                  type="time"
                  className="num h-11"
                  {...register("fromTime")}
                />
              </Field>
              <Field
                id="request-to-time"
                label="Đến giờ"
                error={errors.toTime?.message}
                required
              >
                <Input type="time" className="num h-11" {...register("toTime")} />
              </Field>
            </div>
          ) : null}

          <Field
            id="request-reason"
            label="Lý do"
            hint="Mô tả ngắn gọn để người duyệt hiểu rõ tình huống."
            error={errors.reason?.message}
            required
          >
            <Textarea
              rows={3}
              placeholder="Ví dụ: Về quê giải quyết việc gia đình."
              {...register("reason")}
            />
          </Field>

          <div className="mt-1 grid gap-2">
            <Button type="submit" size="mobile" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  Đang gửi…
                </>
              ) : (
                "Gửi yêu cầu"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="mobile"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
