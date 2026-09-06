"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, TriangleAlert } from "lucide-react";

import { PasswordField } from "@/components/account/password-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACCOUNT_LABELS } from "@/lib/constants";
import { setPasswordSchema, type SetPasswordFormValues } from "@/lib/validation/schemas";

/**
 * Hop thoai tao tai khoan dang nhap cho nhan vien (spec 2026-09-06).
 *
 * Truoc day nut "Tao tai khoan" tao ngay va he thong sinh mat khau tam; gio
 * quan tri dat mat khau, va nhan vien KHONG bi bat doi lan dau.
 *
 * Component chi lo bieu mau — viec goi Server Action va xu ly ket qua do trang
 * chi tiet nhan vien lam, giong khuon cua `ResetPasswordDialog`.
 */
export function CreateAccountDialog({
  employeeName,
  employeeEmail,
  open,
  onOpenChange,
  onSubmit,
}: {
  employeeName: string;
  employeeEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => Promise<void>;
}): React.ReactElement {
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "" },
  });

  /** Xoa sach o nhap va loi moi lan dong — khong de mat khau nam lai trong form. */
  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      reset({ password: "" });
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values.password);
      handleOpenChange(false);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : ACCOUNT_LABELS.genericError,
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ACCOUNT_LABELS.dialogTitle}</DialogTitle>
          <DialogDescription>{ACCOUNT_LABELS.dialogDescription}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="rounded-control border border-hairline bg-canvas-soft px-3 py-2.5">
            <p className="text-[13px] text-ink-muted">{ACCOUNT_LABELS.employeeLabel}</p>
            <p className="mt-0.5 text-sm font-medium text-ink">{employeeName}</p>
            <p className="text-[13px] text-ink-secondary">{employeeEmail}</p>
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

          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <PasswordField
                id="createAccountPassword"
                label={ACCOUNT_LABELS.passwordLabel}
                value={field.value}
                onChange={field.onChange}
                error={errors.password?.message}
              />
            )}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {ACCOUNT_LABELS.cancelButton}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  {ACCOUNT_LABELS.createButtonPending}
                </>
              ) : (
                ACCOUNT_LABELS.createButtonIdle
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
