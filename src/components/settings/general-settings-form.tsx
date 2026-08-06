"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCompanySettings } from "@/lib/data/settings";
import { SETTINGS_GENERAL_LABEL, SETTINGS_LABEL } from "@/lib/constants";
import type { CompanySettings } from "@/lib/types/domain";

/**
 * Tab "Chung" cua `/admin/settings` (plan 04-01). Bon nguong van hanh, MOT nut
 * chinh duy nhat (quy uoc `globals.css`: moi khu vuc chi mot nut filled indigo).
 *
 * Schema o day la ban SONG SONG cua `companySettingsInputSchema` nhung voi moi
 * truong BAT BUOC — form luon gui du bon truong (nguoi dung thay ca bon o cung
 * mot cho), trong khi Server Action nhan patch tung phan de cac plan sau goi
 * duoc voi mot truong. Rang buoc so o hai noi phai khop nhau; noi quyet dinh
 * cuoi cung van la database (CHECK cua migration 0015).
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const generalSettingsFormSchema = z
  .object({
    suspiciousDistanceMultiplier: z
      .number({ invalid_type_error: "Vui lòng nhập ngưỡng đáng ngờ." })
      .positive("Ngưỡng đáng ngờ phải lớn hơn 0.")
      .max(999.99, "Ngưỡng đáng ngờ quá lớn."),
    shiftWindowGraceMinutes: z
      .number({ invalid_type_error: "Vui lòng nhập biên độ khung giờ ca." })
      .int("Biên độ phải là số nguyên (đơn vị phút).")
      .min(0, "Biên độ không được là số âm.")
      .max(720, "Biên độ không vượt quá 720 phút (12 giờ)."),
    nightStartTime: z
      .string()
      .regex(TIME_PATTERN, "Giờ bắt đầu ca đêm phải theo định dạng HH:mm."),
    nightEndTime: z
      .string()
      .regex(TIME_PATTERN, "Giờ kết thúc ca đêm phải theo định dạng HH:mm."),
  })
  .refine((values) => values.nightStartTime !== values.nightEndTime, {
    path: ["nightEndTime"],
    message: "Giờ bắt đầu và giờ kết thúc ca đêm không được trùng nhau.",
  });

type GeneralSettingsFormValues = z.infer<typeof generalSettingsFormSchema>;

function toFormValues(settings: CompanySettings): GeneralSettingsFormValues {
  return {
    suspiciousDistanceMultiplier: settings.suspiciousDistanceMultiplier,
    shiftWindowGraceMinutes: settings.shiftWindowGraceMinutes,
    nightStartTime: settings.nightStartTime,
    nightEndTime: settings.nightEndTime,
  };
}

export function GeneralSettingsForm({
  settings,
  onSaved,
}: {
  settings: CompanySettings;
  onSaved: () => void;
}): React.ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<GeneralSettingsFormValues>({
    resolver: zodResolver(generalSettingsFormSchema),
    defaultValues: toFormValues(settings),
  });

  // Cau hinh tai lai sau khi luu (hoac khi doi doanh nghiep) — dong bo lai gia
  // tri mac dinh cua form thay vi giu ban chup luc mount.
  React.useEffect(() => {
    reset(toFormValues(settings));
  }, [settings, reset]);

  const onSubmit = async (values: GeneralSettingsFormValues): Promise<void> => {
    try {
      await updateCompanySettings(values);
      toast.success(SETTINGS_LABEL.saveSuccess);
      onSaved();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : SETTINGS_LABEL.saveError);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-ink">
          {SETTINGS_GENERAL_LABEL.sectionTitle}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {SETTINGS_GENERAL_LABEL.sectionDescription}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          id="settings-suspicious-multiplier"
          label={SETTINGS_GENERAL_LABEL.suspiciousMultiplierLabel}
          hint={SETTINGS_GENERAL_LABEL.suspiciousMultiplierHelp}
          error={errors.suspiciousDistanceMultiplier?.message}
          required
        >
          <Input
            type="number"
            step="0.1"
            min="0.1"
            className="num"
            {...register("suspiciousDistanceMultiplier", { valueAsNumber: true })}
          />
        </Field>

        <Field
          id="settings-shift-window-grace"
          label={SETTINGS_GENERAL_LABEL.shiftWindowGraceLabel}
          hint={SETTINGS_GENERAL_LABEL.shiftWindowGraceHelp}
          error={errors.shiftWindowGraceMinutes?.message}
          required
        >
          <Input
            type="number"
            step="1"
            min="0"
            className="num"
            {...register("shiftWindowGraceMinutes", { valueAsNumber: true })}
          />
        </Field>

        <Field
          id="settings-night-start"
          label={SETTINGS_GENERAL_LABEL.nightStartLabel}
          error={errors.nightStartTime?.message}
          required
        >
          <Input type="time" className="num" {...register("nightStartTime")} />
        </Field>

        <Field
          id="settings-night-end"
          label={SETTINGS_GENERAL_LABEL.nightEndLabel}
          hint={SETTINGS_GENERAL_LABEL.nightHelp}
          error={errors.nightEndTime?.message}
          required
        >
          <Input type="time" className="num" {...register("nightEndTime")} />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {SETTINGS_LABEL.saveButton}
        </Button>
      </div>
    </form>
  );
}
