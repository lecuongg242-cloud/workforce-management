"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, Plus, Timer } from "lucide-react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { ErrorState } from "@/components/common/error-state";
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
import {
  EMPLOYEE_OVERTIME_RATE_LABEL as LABEL,
  OVERTIME_RATE_VALUE_TYPE_LABEL,
  OVERTIME_RATE_VALUE_TYPE_OPTIONS,
} from "@/lib/constants";
import {
  createEmployeeOvertimeRate,
  getEmployeeOvertimeRateHistory,
} from "@/lib/data/employee-overtime-rates";
import { useDataStore } from "@/lib/data/store";
import { formatDate, formatNumber, formatVnd } from "@/lib/format";
import type { OvertimeRateValueType } from "@/lib/types/domain";

/**
 * TIEN TANG CA RIENG cua mot nhan vien (migration 0026) — o tab "Thong tin
 * luong" cua `/admin/employees/[id]`, ngay duoi muc luong.
 *
 * Cung khuon man hinh voi `pay-rate-panel.tsx` vi cung mot loai bang: APPEND-
 * ONLY, khong nut sua, khong nut xoa, va man hinh noi RO vi sao ngay tai cho.
 *
 * HAI DIEU MAN HINH NAY PHAI NOI RA, vi ca hai deu la hau qua tien bac ma
 * nguoi khai khong the suy ra tu o nhap:
 *   1. Khong khai gi = an theo he so CHUNG cua doanh nghiep. Do khac han
 *      "tang ca bang 0", va mot dong chu "chua khai" chung chung se doc ra
 *      thanh nghia thu hai.
 *   2. Khai mot muc rieng = muc do an TRON ca bon loai ngay (thuong, nghi, le,
 *      dem). Nguoi khai 60.000d/gio cho mot cong nhan can biet rang ngay le
 *      cua nguoi do tu nay cung la 60.000d/gio.
 */
export function OvertimeRatePanel({
  employeeId,
  today,
}: {
  employeeId: string;
  /** Ngay SERVER (D-19) — mac dinh cua o hieu luc va moc phan biet qua khu. */
  today: string;
}): React.ReactElement {
  const { invalidate } = useDataStore();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const { data: history, isLoading, error, reload } = useDataQuery(
    () => getEmployeeOvertimeRateHistory(employeeId),
    [employeeId],
  );

  const handleSubmit = async (values: OvertimeRateFormValues): Promise<void> => {
    try {
      await createEmployeeOvertimeRate({ employeeId, ...values });
      toast.success(LABEL.saveSuccess);
      invalidate();
      reload();
      setIsDialogOpen(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : LABEL.saveError);
    }
  };

  if (isLoading) {
    return (
      <section className="surface-card space-y-4 p-5">
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="surface-card">
        <ErrorState description={error} onRetry={reload} />
      </section>
    );
  }

  const versions = history?.versions ?? [];
  const current = history?.current ?? null;

  return (
    <div className="grid gap-4">
      <section className="surface-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="heading-sm flex items-center gap-2 text-ink">
              <Timer aria-hidden className="size-4 text-ink-muted" />
              {LABEL.sectionTitle}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">{LABEL.currentTitle}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            {LABEL.declareAction}
          </Button>
        </div>

        <div className="mt-4">
          {current ? (
            <>
              <p className="num display-md text-ink">
                {current.valueType === "fixed_hourly"
                  ? formatVnd(current.value)
                  : formatNumber(current.value)}{" "}
                <span className="text-base font-normal text-ink-muted">
                  {current.valueType === "fixed_hourly"
                    ? LABEL.suffixPerHour
                    : LABEL.suffixMultiplier}
                </span>
              </p>
              <p className="num mt-1 text-xs text-ink-muted">
                {LABEL.columnEffectiveFrom} {formatDate(current.effectiveFrom)}
              </p>
              <p className="mt-3 flex items-start gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5 text-xs text-ink-secondary">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0"
                />
                <span>{LABEL.scopeWarning}</span>
              </p>
            </>
          ) : (
            // KHONG khai khac han "bang 0": cau duoi day noi dung dieu dang
            // xay ra — nguoi nay an theo he so cua doanh nghiep.
            <div className="flex items-start gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5">
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-ink-muted"
              />
              <div>
                <p className="text-sm font-medium text-ink">{LABEL.notDeclared}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {versions.length > 0
                    ? LABEL.futureOnlyHint
                    : LABEL.notDeclaredHint}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {versions.length > 0 ? (
        <section className="surface-card overflow-hidden">
          <header className="border-b border-hairline px-4 py-3.5">
            <h2 className="heading-sm text-ink">{LABEL.historyTitle}</h2>
            <p className="mt-0.5 text-xs text-ink-muted">{LABEL.appendOnlyNote}</p>
          </header>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{LABEL.columnEffectiveFrom}</TableHead>
                  <TableHead>{LABEL.columnValueType}</TableHead>
                  <TableHead className="text-right">{LABEL.columnValue}</TableHead>
                  <TableHead>{LABEL.columnCreatedBy}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="num font-medium text-ink">
                      {formatDate(version.effectiveFrom)}
                    </TableCell>
                    <TableCell>
                      {OVERTIME_RATE_VALUE_TYPE_LABEL[version.valueType]}
                    </TableCell>
                    <TableCell className="num text-right font-medium text-ink">
                      {version.valueType === "fixed_hourly"
                        ? formatVnd(version.value)
                        : `${formatNumber(version.value)}×`}
                    </TableCell>
                    <TableCell className="num text-ink-muted">
                      {version.createdBy
                        ? version.createdBy.slice(0, 8)
                        : LABEL.unknownAuthor}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      <OvertimeRateDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        today={today}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const overtimeRateFormSchema = z
  .object({
    valueType: z.enum(["multiplier", "fixed_hourly"]),
    value: z
      .number({ invalid_type_error: "Vui lòng nhập giá trị." })
      .positive("Giá trị phải lớn hơn 0."),
    effectiveFrom: z
      .string()
      .regex(DATE_PATTERN, "Vui lòng chọn ngày bắt đầu hiệu lực."),
  })
  // Cung hai bien tren voi `employeeOvertimeRateInputSchema` phia server —
  // hai lop, mot bo quy tac.
  .superRefine((values, ctx) => {
    if (values.valueType === "multiplier" && values.value > 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Hệ số tăng ca không vượt quá 10 lần đơn giá giờ.",
      });
    }
    if (values.valueType === "fixed_hourly" && values.value > 10_000_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Số tiền một giờ tăng ca quá lớn.",
      });
    }
  });

type OvertimeRateFormValues = {
  valueType: OvertimeRateValueType;
  value: number;
  effectiveFrom: string;
};

function OvertimeRateDialog({
  open,
  onOpenChange,
  today,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: string;
  onSubmit: (values: OvertimeRateFormValues) => Promise<void>;
}): React.ReactElement {
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OvertimeRateFormValues>({
    resolver: zodResolver(overtimeRateFormSchema),
    // Mac dinh la SO TIEN: do la cach doanh nghiep nho viet mot thoa thuan
    // rieng ("tang ca 60.000/gio"). Khong dien san mot con so nao (D-26).
    defaultValues: {
      valueType: "fixed_hourly",
      value: undefined,
      effectiveFrom: today,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    reset({ valueType: "fixed_hourly", value: undefined, effectiveFrom: today });
  }, [open, today, reset]);

  const valueType = watch("valueType");
  const effectiveFrom = watch("effectiveFrom");
  const isRetroactive = Boolean(effectiveFrom) && effectiveFrom < today;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{LABEL.dialogTitle}</DialogTitle>
          <DialogDescription>{LABEL.dialogDescription}</DialogDescription>
        </DialogHeader>

        <form
          id="overtime-rate-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <Field
            id="overtime-rate-type"
            label={LABEL.fieldValueType}
            error={errors.valueType?.message}
            required
          >
            <Controller
              control={control}
              name="valueType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="overtime-rate-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OVERTIME_RATE_VALUE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            id="overtime-rate-value"
            // Nhan doi theo kieu khai: "60000" o o tien va "1,5" o o he so la
            // hai dai luong khac han nhau, mot nhan chung se lam nguoi dung go
            // nham don vi.
            label={
              valueType === "fixed_hourly"
                ? LABEL.fieldValueFixed
                : LABEL.fieldValueMultiplier
            }
            error={errors.value?.message}
            required
          >
            <Input
              type="number"
              step={valueType === "fixed_hourly" ? 1000 : 0.1}
              min={0}
              className="num"
              {...register("value", { valueAsNumber: true })}
            />
          </Field>

          <Field
            id="overtime-rate-effective-from"
            label={LABEL.fieldEffectiveFrom}
            error={errors.effectiveFrom?.message}
            required
          >
            <Input type="date" className="num" {...register("effectiveFrom")} />
          </Field>

          <p className="flex items-start gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5 text-xs text-ink-secondary">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {LABEL.scopeWarning} {LABEL.legalNote}
            </span>
          </p>

          {isRetroactive ? (
            <p className="flex items-start gap-2 rounded-control border border-warning-border bg-warning-soft px-3 py-2.5 text-xs text-ink">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>{LABEL.retroWarning}</span>
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
            {LABEL.cancel}
          </Button>
          <Button type="submit" form="overtime-rate-form" disabled={isSubmitting}>
            {LABEL.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
