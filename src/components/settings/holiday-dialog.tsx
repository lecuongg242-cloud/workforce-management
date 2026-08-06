"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
import { SETTINGS_HOLIDAY_LABEL } from "@/lib/constants";
import type { Holiday } from "@/lib/types/domain";

/**
 * Hop thoai them / sua ngay nghi le (SET-02, plan 04-03).
 *
 * Hai truong, khong hon: ngay va ten. Viec canh bao khi cham vao qua khu
 * KHONG nam o day ma o `HolidaysTab` — vi no can mot con so do SERVER dem
 * (`countAffectedAttendance`) va mot buoc xac nhan rieng.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const holidayFormSchema = z.object({
  date: z.string().regex(DATE_PATTERN, "Vui lòng chọn ngày nghỉ lễ."),
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên ngày nghỉ lễ.")
    .max(120, "Tên ngày nghỉ lễ quá dài."),
});

export type HolidayFormValues = z.infer<typeof holidayFormSchema>;

export function HolidayDialog({
  open,
  onOpenChange,
  holiday,
  defaultDate,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holiday: Holiday | null;
  /** Ngay goi y khi them moi — lay tu ngay SERVER, khong tu dong ho trinh duyet. */
  defaultDate: string;
  onSubmit: (values: HolidayFormValues) => Promise<void>;
}): React.ReactElement {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: { date: defaultDate, name: "" },
  });

  React.useEffect(() => {
    if (!open) return;
    reset(
      holiday
        ? { date: holiday.date, name: holiday.name }
        : { date: defaultDate, name: "" },
    );
  }, [open, holiday, defaultDate, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {holiday
              ? SETTINGS_HOLIDAY_LABEL.dialogEditTitle
              : SETTINGS_HOLIDAY_LABEL.dialogCreateTitle}
          </DialogTitle>
          <DialogDescription>
            {SETTINGS_HOLIDAY_LABEL.dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <form
          id="holiday-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <Field
            id="holiday-form-date"
            label={SETTINGS_HOLIDAY_LABEL.fieldDate}
            error={errors.date?.message}
            required
          >
            <Input type="date" className="num" {...register("date")} />
          </Field>

          <Field
            id="holiday-form-name"
            label={SETTINGS_HOLIDAY_LABEL.fieldName}
            error={errors.name?.message}
            required
          >
            <Input placeholder={SETTINGS_HOLIDAY_LABEL.fieldNamePlaceholder} {...register("name")} />
          </Field>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {SETTINGS_HOLIDAY_LABEL.cancel}
          </Button>
          <Button type="submit" form="holiday-form" disabled={isSubmitting}>
            {SETTINGS_HOLIDAY_LABEL.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
