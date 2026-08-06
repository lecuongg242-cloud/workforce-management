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
import {
  OVERTIME_RULE_KEY_LABEL,
  SETTINGS_OVERTIME_LABEL,
} from "@/lib/constants";
import type { OvertimeRuleKey } from "@/lib/types/domain";

/**
 * Hop thoai khai MOT PHIEN BAN he so moi (SET-03, plan 04-04).
 *
 * KHONG co gia tri goi y nao cho o he so: mot con so dien san — ke ca dung
 * theo luat lao dong — la mot cach ngam de xuat rang he thong biet truoc muc
 * doanh nghiep nen tra, trai voi D-26.
 *
 * Ngay hieu luc mac dinh la NGAY SERVER (truyen vao qua prop). Chon lui vao
 * qua khu van duoc, nhung khi do hop thoai noi ro day la thay doi hoi to.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const overtimeRuleFormSchema = z.object({
  multiplier: z
    .number({ invalid_type_error: "Vui lòng nhập hệ số tăng ca." })
    .positive("Hệ số tăng ca phải lớn hơn 0.")
    .max(99.99, "Hệ số tăng ca quá lớn."),
  effectiveFrom: z
    .string()
    .regex(DATE_PATTERN, "Vui lòng chọn ngày bắt đầu hiệu lực."),
});

export type OvertimeRuleFormValues = z.infer<typeof overtimeRuleFormSchema>;

export function OvertimeRuleDialog({
  open,
  onOpenChange,
  ruleKey,
  today,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleKey: OvertimeRuleKey | null;
  /** Ngay SERVER — dung lam mac dinh va lam moc phan biet qua khu. */
  today: string;
  onSubmit: (values: OvertimeRuleFormValues) => Promise<void>;
}): React.ReactElement {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OvertimeRuleFormValues>({
    resolver: zodResolver(overtimeRuleFormSchema),
    // `multiplier` co y de trong (NaN sau khi valueAsNumber) — khong dien san
    // mot he so nao, xem khoi comment o tren.
    defaultValues: { multiplier: undefined, effectiveFrom: today },
  });

  React.useEffect(() => {
    if (!open) return;
    reset({ multiplier: undefined, effectiveFrom: today });
  }, [open, today, reset]);

  const isPremium = ruleKey === "night";
  const effectiveFrom = watch("effectiveFrom");
  const isRetroactive = Boolean(effectiveFrom) && effectiveFrom < today;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {SETTINGS_OVERTIME_LABEL.dialogTitle}
            {ruleKey ? ` — ${OVERTIME_RULE_KEY_LABEL[ruleKey]}` : ""}
          </DialogTitle>
          <DialogDescription>
            {SETTINGS_OVERTIME_LABEL.dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <form
          id="overtime-rule-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          {/* D-28a: khoa `night` la PHU CAP CONG THEM chu khong phai he so
              nhan — nhan va chu tro giup phai noi dung dieu do ngay tai o
              nhap, vi mot nguoi dien 1.3 vao day (theo thoi quen "he so") se
              lam con so quy doi sai gap boi. */}
          <Field
            id="overtime-rule-multiplier"
            label={
              isPremium
                ? SETTINGS_OVERTIME_LABEL.fieldMultiplierNight
                : SETTINGS_OVERTIME_LABEL.fieldMultiplier
            }
            hint={
              isPremium ? SETTINGS_OVERTIME_LABEL.fieldMultiplierNightHint : undefined
            }
            error={errors.multiplier?.message}
            required
          >
            <Input
              type="number"
              step="0.05"
              min="0.05"
              className="num"
              {...register("multiplier", { valueAsNumber: true })}
            />
          </Field>

          <Field
            id="overtime-rule-effective-from"
            label={SETTINGS_OVERTIME_LABEL.fieldEffectiveFrom}
            error={errors.effectiveFrom?.message}
            required
          >
            <Input type="date" className="num" {...register("effectiveFrom")} />
          </Field>

          {isRetroactive ? (
            <p
              role="alert"
              className="rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-xs text-ink"
            >
              {SETTINGS_OVERTIME_LABEL.retroWarning}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {SETTINGS_OVERTIME_LABEL.cancel}
          </Button>
          <Button type="submit" form="overtime-rule-form" disabled={isSubmitting}>
            {SETTINGS_OVERTIME_LABEL.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
