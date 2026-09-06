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
import { CHANGE_OWN_PASSWORD_LABELS } from "@/lib/constants";
import { changeOwnPassword } from "@/lib/data/mutations/accounts";
import {
  changeOwnPasswordSchema,
  type ChangeOwnPasswordFormValues,
} from "@/lib/validation/schemas";

/**
 * Hop thoai nguoi dung TU doi mat khau (spec 2026-09-06).
 *
 * Dung chung cho CA HAI khu: menu avatar cua `/admin` va trang ho so cua
 * `/employee`. Mot hop thoai duy nhat, khong nhan ban — luat mat khau va
 * thong diep loi chi ton tai o mot cho.
 */
export function ChangeOwnPasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeOwnPasswordFormValues>({
    resolver: zodResolver(changeOwnPasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  /** Xoa sach o nhap va loi moi lan dong — khong de mat khau nam lai trong form. */
  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await changeOwnPassword(values.currentPassword, values.newPassword);
      toast.success(CHANGE_OWN_PASSWORD_LABELS.successToast);
      handleOpenChange(false);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error
          ? cause.message
          : CHANGE_OWN_PASSWORD_LABELS.genericError,
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{CHANGE_OWN_PASSWORD_LABELS.dialogTitle}</DialogTitle>
          <DialogDescription>
            {CHANGE_OWN_PASSWORD_LABELS.dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
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
            id="ownCurrentPassword"
            label={CHANGE_OWN_PASSWORD_LABELS.currentPasswordLabel}
            error={errors.currentPassword?.message}
            required
          >
            <Input
              type="password"
              autoComplete="current-password"
              {...register("currentPassword")}
            />
          </Field>

          <Field
            id="ownNewPassword"
            label={CHANGE_OWN_PASSWORD_LABELS.newPasswordLabel}
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
            id="ownConfirmPassword"
            label={CHANGE_OWN_PASSWORD_LABELS.confirmPasswordLabel}
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
              {CHANGE_OWN_PASSWORD_LABELS.cancelButton}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  {CHANGE_OWN_PASSWORD_LABELS.submitPending}
                </>
              ) : (
                CHANGE_OWN_PASSWORD_LABELS.submitIdle
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
