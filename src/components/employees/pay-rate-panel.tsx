"use client";

import * as React from "react";
import { AlertCircle, Plus, Wallet } from "lucide-react";
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
  PAY_RATE_LABEL,
  PAY_RATE_UNIT_LABEL,
  PAY_RATE_UNIT_OPTIONS,
  PAY_RATE_UNIT_SUFFIX,
} from "@/lib/constants";
import { createPayRate, getPayRateHistory } from "@/lib/data/pay-rates";
import { useDataStore } from "@/lib/data/store";
import { formatDate, formatVnd } from "@/lib/format";
import type { PayRateUnit } from "@/lib/types/domain";

/**
 * Tab "Thong tin luong" cua `/admin/employees/[id]` (PAY-06, plan 05-2-01).
 * Thay cho `EmptyState` hua "se duoc thiet lap trong giai doan tiep theo" cua
 * V1 — day la giai doan do.
 *
 * Khuon man hinh cho mot bang APPEND-ONLY, nhan lai tu `overtime-rules-tab.tsx`
 * (04-04): hien lich su phien ban, mot nut them phien ban moi, KHONG co nut
 * sua va KHONG co nut xoa. Man hinh noi ro vi sao ngay tai cho (D-37a) —
 * neu khong, su vang mat cua hai nut do doc ra thanh mot tinh nang con thieu.
 *
 * Man hinh nay KHONG tinh mot con so tien nao ngoai muc luong da khai. Phep
 * tinh luong la 05-2-04.
 */
export function PayRatePanel({
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
    () => getPayRateHistory(employeeId),
    [employeeId],
  );

  const handleSubmit = async (values: PayRateFormValues): Promise<void> => {
    try {
      await createPayRate({ employeeId, ...values });
      toast.success(PAY_RATE_LABEL.saveSuccess);
      invalidate();
      reload();
      setIsDialogOpen(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : PAY_RATE_LABEL.saveError);
    }
  };

  if (isLoading) {
    return (
      <section className="surface-card space-y-4 p-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
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
      {/* -------------------------------------------------- Dang hieu luc */}
      <section className="surface-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="heading-sm flex items-center gap-2 text-ink">
              <Wallet aria-hidden className="size-4 text-ink-muted" />
              {PAY_RATE_LABEL.sectionTitle}
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {PAY_RATE_LABEL.currentTitle}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            {PAY_RATE_LABEL.declareAction}
          </Button>
        </div>

        <div className="mt-4">
          {current ? (
            <>
              <p className="num display-md text-ink">
                {formatVnd(current.amount)}{" "}
                <span className="text-base font-normal text-ink-muted">
                  / {PAY_RATE_UNIT_SUFFIX[current.unit]}
                </span>
              </p>
              <p className="num mt-1 text-xs text-ink-muted">
                {PAY_RATE_LABEL.columnEffectiveFrom} {formatDate(current.effectiveFrom)}
              </p>
            </>
          ) : (
            // Chua khai thi noi THANG la chua khai kem he qua — khong hien 0,
            // va khong hien mot con so goi y nao (D-26).
            <div className="flex items-start gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-muted" />
              <div>
                <p className="text-sm font-medium text-ink">
                  {PAY_RATE_LABEL.notDeclared}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {versions.length > 0
                    ? PAY_RATE_LABEL.futureOnlyHint
                    : PAY_RATE_LABEL.notDeclaredHint}
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-ink-muted">{PAY_RATE_LABEL.disclaimer}</p>
      </section>

      {/* -------------------------------------------------- Lich su */}
      <section className="surface-card overflow-hidden">
        <header className="border-b border-hairline px-4 py-3.5">
          <h2 className="heading-sm text-ink">{PAY_RATE_LABEL.historyTitle}</h2>
          {/* Vi sao khong co nut sua/xoa — noi ngay tai cho, khong de nguoi
              dung tu suy ra tu su vang mat cua chung (D-37a). */}
          <p className="mt-0.5 text-xs text-ink-muted">
            {PAY_RATE_LABEL.appendOnlyNote}
          </p>
        </header>

        {versions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-muted">
            {PAY_RATE_LABEL.historyEmpty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{PAY_RATE_LABEL.columnEffectiveFrom}</TableHead>
                  <TableHead>{PAY_RATE_LABEL.columnUnit}</TableHead>
                  <TableHead className="text-right">
                    {PAY_RATE_LABEL.columnAmount}
                  </TableHead>
                  <TableHead>{PAY_RATE_LABEL.columnCreatedBy}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="num font-medium text-ink">
                      {formatDate(version.effectiveFrom)}
                    </TableCell>
                    <TableCell>{PAY_RATE_UNIT_LABEL[version.unit]}</TableCell>
                    <TableCell className="num text-right font-medium text-ink">
                      {formatVnd(version.amount)}
                    </TableCell>
                    <TableCell className="num text-ink-muted">
                      {version.createdBy
                        ? version.createdBy.slice(0, 8)
                        : PAY_RATE_LABEL.unknownAuthor}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <PayRateDialog
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

const payRateFormSchema = z.object({
  unit: z.enum(["month", "day", "hour"]),
  amount: z
    .number({ invalid_type_error: "Vui lòng nhập số tiền." })
    .positive("Số tiền phải lớn hơn 0.")
    .max(999999999999, "Số tiền quá lớn."),
  effectiveFrom: z
    .string()
    .regex(DATE_PATTERN, "Vui lòng chọn ngày bắt đầu hiệu lực."),
});

type PayRateFormValues = { unit: PayRateUnit; amount: number; effectiveFrom: string };

/**
 * KHONG co gia tri goi y nao cho o so tien: mot con so dien san la mot cach
 * ngam de xuat rang he thong biet truoc muc doanh nghiep nen tra (D-26).
 * Don vi thi CO mac dinh `month` — do la mot don vi do, khong phai mot muc gia.
 */
function PayRateDialog({
  open,
  onOpenChange,
  today,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: string;
  onSubmit: (values: PayRateFormValues) => Promise<void>;
}): React.ReactElement {
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PayRateFormValues>({
    resolver: zodResolver(payRateFormSchema),
    defaultValues: { unit: "month", amount: undefined, effectiveFrom: today },
  });

  React.useEffect(() => {
    if (!open) return;
    reset({ unit: "month", amount: undefined, effectiveFrom: today });
  }, [open, today, reset]);

  const effectiveFrom = watch("effectiveFrom");
  const isRetroactive = Boolean(effectiveFrom) && effectiveFrom < today;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{PAY_RATE_LABEL.dialogTitle}</DialogTitle>
          <DialogDescription>{PAY_RATE_LABEL.dialogDescription}</DialogDescription>
        </DialogHeader>

        <form id="pay-rate-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <Field
            id="pay-rate-unit"
            label={PAY_RATE_LABEL.fieldUnit}
            error={errors.unit?.message}
            required
          >
            <Controller
              control={control}
              name="unit"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="pay-rate-unit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_RATE_UNIT_OPTIONS.map((option) => (
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
            id="pay-rate-amount"
            label={PAY_RATE_LABEL.fieldAmount}
            error={errors.amount?.message}
            required
          >
            <Input
              type="number"
              step="1000"
              min="1"
              className="num"
              {...register("amount", { valueAsNumber: true })}
            />
          </Field>

          <Field
            id="pay-rate-effective-from"
            label={PAY_RATE_LABEL.fieldEffectiveFrom}
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
              {PAY_RATE_LABEL.retroWarning}
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
            {PAY_RATE_LABEL.cancel}
          </Button>
          <Button type="submit" form="pay-rate-form" disabled={isSubmitting}>
            {PAY_RATE_LABEL.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
