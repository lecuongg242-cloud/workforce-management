"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

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
import { updateCompanySettings } from "@/lib/data/settings";
import {
  SETTINGS_GENERAL_LABEL,
  SETTINGS_LABEL,
  WORK_MODE_HINT,
  WORK_MODE_OPTIONS,
} from "@/lib/constants";
import { workModeSchema } from "@/lib/validation/api/settings";
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

/**
 * `valueAsNumber` cua react-hook-form tra `NaN` cho o rong, nen "de trong"
 * phai thanh `null` TRUOC khi kiem — neu khong, mot cau tra loi HOP LE ("chua
 * khai") se hien ra thanh mot loi nhap lieu. Dung chung cho tran tang ca va
 * hai mau so quy doi.
 */
function emptyToNull(value: unknown): unknown {
  return value === "" ||
    value === null ||
    value === undefined ||
    (typeof value === "number" && Number.isNaN(value))
    ? null
    : value;
}

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
    // SET-05 — truong DUY NHAT cua form nay duoc phep de trong. `valueAsNumber`
    // cua react-hook-form tra `NaN` cho o rong, nen phai doi NaN -> null TRUOC
    // khi kiem; neu khong, "de trong" se thanh mot loi nhap lieu thay vi mot
    // cau tra loi hop le ("khong gioi han").
    overtimeCapHoursPerMonth: z.preprocess(
      emptyToNull,
      z
        .number({ invalid_type_error: "Trần tăng ca phải là một con số." })
        .positive("Trần tăng ca phải lớn hơn 0 — để trống nếu không giới hạn.")
        .max(9999.99, "Trần tăng ca quá lớn.")
        .nullable(),
    ),
    // D-36: khong bao gio de trong — cot nay luon co gia tri o database.
    workMode: workModeSchema,
    // D-38: hai mau so DE TRONG DUOC. Form KHONG chan luu khi chua khai, chi
    // noi ro he qua (xem canh bao duoi o chon che do) — doanh nghiep khai sau
    // duoc, va chan luu se lam ho khong luu duoc ca bon truong con lai.
    standardHoursPerDay: z.preprocess(
      emptyToNull,
      z
        .number({
          invalid_type_error: "Số giờ chuẩn một ngày công phải là một con số.",
        })
        .positive("Số giờ chuẩn một ngày công phải lớn hơn 0 — để trống nếu chưa khai.")
        .max(24, "Một ngày công không vượt quá 24 giờ.")
        .nullable(),
    ),
    standardDaysPerMonth: z.preprocess(
      emptyToNull,
      z
        .number({
          invalid_type_error: "Số ngày công chuẩn một tháng phải là một con số.",
        })
        .positive(
          "Số ngày công chuẩn một tháng phải lớn hơn 0 — để trống nếu chưa khai.",
        )
        .max(31, "Một tháng không vượt quá 31 ngày công.")
        .nullable(),
    ),
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
    overtimeCapHoursPerMonth: settings.overtimeCapHoursPerMonth,
    workMode: settings.workMode,
    standardHoursPerDay: settings.standardHoursPerDay,
    standardDaysPerMonth: settings.standardDaysPerMonth,
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
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<GeneralSettingsFormValues>({
    resolver: zodResolver(generalSettingsFormSchema),
    defaultValues: toFormValues(settings),
  });

  // Canh bao NGAY TAI CHO khi chon `daily_hours` ma chua khai so gio chuan:
  // che do do tinh mot cong bang so gio chuan, khong co con so ay thi khong
  // quy doi duoc. KHONG chan luu (doanh nghiep khai sau duoc) — chi noi ro he
  // qua, dung khuon D-26: cho nao chua khai thi noi thang la chua khai.
  const workMode = useWatch({ control, name: "workMode" });
  const standardHoursPerDay = useWatch({ control, name: "standardHoursPerDay" });
  const needsStandardHours =
    workMode === "daily_hours" &&
    (standardHoursPerDay === null || standardHoursPerDay === undefined);

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

        {/* Truong duy nhat khong `required`: de trong la mot cau tra loi hop
            le ("khong gioi han"), khong phai mot o bi bo quen. */}
        <Field
          id="settings-overtime-cap"
          label={SETTINGS_GENERAL_LABEL.overtimeCapLabel}
          hint={SETTINGS_GENERAL_LABEL.overtimeCapHelp}
          error={errors.overtimeCapHoursPerMonth?.message}
        >
          <Input
            type="number"
            step="0.5"
            min="0.5"
            placeholder="Không giới hạn"
            className="num"
            {...register("overtimeCapHoursPerMonth", { valueAsNumber: true })}
          />
        </Field>
      </div>

      {/* -------------------------------------------------- Cach tinh cong */}
      <div className="border-t border-hairline pt-6">
        <h2 className="text-base font-semibold text-ink">
          {SETTINGS_GENERAL_LABEL.workModeSectionTitle}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {SETTINGS_GENERAL_LABEL.workModeSectionDescription}
        </p>

        <div className="mt-5 grid gap-5">
          <Field
            id="settings-work-mode"
            label={SETTINGS_GENERAL_LABEL.workModeLabel}
            hint={SETTINGS_GENERAL_LABEL.workModeHelp}
            error={errors.workMode?.message}
            required
          >
            <Controller
              control={control}
              name="workMode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="settings-work-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {/* He qua cua lua chon dang chon, noi ngay duoi o chon — khong bat
              nguoi dung mo tai lieu khac de biet minh vua doi dinh nghia gi. */}
          {workMode ? (
            <p className="-mt-3 text-xs text-ink-muted">{WORK_MODE_HINT[workMode]}</p>
          ) : null}

          {needsStandardHours ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5 text-xs text-ink-secondary"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {SETTINGS_GENERAL_LABEL.standardHoursMissingWarning}
            </p>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            {/* Hai o nay KHONG `required`: de trong la mot cau tra loi hop le
                ("chua khai"), khong phai mot o bi bo quen (D-38). */}
            <Field
              id="settings-standard-hours-per-day"
              label={SETTINGS_GENERAL_LABEL.standardHoursPerDayLabel}
              hint={SETTINGS_GENERAL_LABEL.standardHoursPerDayHelp}
              error={errors.standardHoursPerDay?.message}
            >
              <Input
                type="number"
                step="0.5"
                min="0.5"
                placeholder="Chưa khai"
                className="num"
                {...register("standardHoursPerDay", { valueAsNumber: true })}
              />
            </Field>

            <Field
              id="settings-standard-days-per-month"
              label={SETTINGS_GENERAL_LABEL.standardDaysPerMonthLabel}
              hint={SETTINGS_GENERAL_LABEL.standardDaysPerMonthHelp}
              error={errors.standardDaysPerMonth?.message}
            >
              <Input
                type="number"
                step="0.5"
                min="0.5"
                placeholder="Chưa khai"
                className="num"
                {...register("standardDaysPerMonth", { valueAsNumber: true })}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {SETTINGS_LABEL.saveButton}
        </Button>
      </div>
    </form>
  );
}
