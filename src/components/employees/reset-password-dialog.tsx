"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
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
import { RESET_PASSWORD_LABELS } from "@/lib/constants";
import { setEmployeePassword } from "@/lib/data/mutations/accounts";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/lib/validation/schemas";

/**
 * Hop thoai quan tri dat lai mat khau cho mot nhan vien (spec 2026-09-06).
 *
 * Dung lai `changePasswordSchema` cua luong doi mat khau bat buoc — cung mot
 * luat that su (moi >= 8 ky tu, nhap lai phai khop), khong viet schema rieng.
 *
 * Hien ten + email nhan vien ngay trong hop thoai: day la thao tac khong hoan
 * tac duoc, admin phai nhin thay minh dang doi cho AI truoc khi bam.
 */
export function ResetPasswordDialog({
  employeeName,
  employeeEmail,
  employeeId,
  open,
  onOpenChange,
}: {
  employeeName: string;
  employeeEmail: string;
  employeeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  /**
   * Xoa sach o nhap va thong diep loi MOI LAN dong/mo. Khong de mat khau vua
   * go nam lai trong bo nho form sau khi hop thoai dong — va khong de loi cua
   * lan truoc hien ra o lan mo sau.
   */
  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      reset({ newPassword: "", confirmPassword: "" });
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await setEmployeePassword(employeeId, values.newPassword);
      toast.success(RESET_PASSWORD_LABELS.successToast);
      handleOpenChange(false);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : RESET_PASSWORD_LABELS.genericError,
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{RESET_PASSWORD_LABELS.dialogTitle}</DialogTitle>
          <DialogDescription>
            {RESET_PASSWORD_LABELS.dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="rounded-control border border-hairline bg-canvas-soft px-3 py-2.5">
            <p className="text-[13px] text-ink-muted">
              {RESET_PASSWORD_LABELS.employeeLabel}
            </p>
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

          <Field
            id="resetNewPassword"
            label={RESET_PASSWORD_LABELS.newPasswordLabel}
            error={errors.newPassword?.message}
            required
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
            />
          </Field>

          <Field
            id="resetConfirmPassword"
            label={RESET_PASSWORD_LABELS.confirmPasswordLabel}
            error={errors.confirmPassword?.message}
            required
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {RESET_PASSWORD_LABELS.cancelButton}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  {RESET_PASSWORD_LABELS.submitPending}
                </>
              ) : (
                RESET_PASSWORD_LABELS.submitIdle
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
