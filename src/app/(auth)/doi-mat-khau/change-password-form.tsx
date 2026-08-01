"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHANGE_PASSWORD_LABELS } from "@/lib/constants";
import { completeForcedPasswordChange } from "@/lib/data/mutations/accounts";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/lib/validation/schemas";

/**
 * Khuon giong `login-form.tsx`: useForm + zodResolver, loi gui bieu mau hien
 * qua state, nut co trang thai dang gui. Khac biet co chu dich: KHONG gop
 * hai loai thong diep loi (T-02-10-07) — `cause.message` tu Server Action da
 * la mot trong hai chuoi khac nhau cua `CHANGE_PASSWORD_LABELS`, hien
 * NGUYEN VAN, khong doi thanh mot thong diep chung chung o day.
 */
export function ChangePasswordForm(): React.ReactElement {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      // Chi chuyen huong SAU KHI Server Action hoan tat -- ham do da lam moi
      // phien NGAY TRONG cung request truoc khi tra ve (D-16a), nen request
      // ke tiep (trang dashboard) mang token da sach co.
      await completeForcedPasswordChange(values.newPassword);
      toast.success(CHANGE_PASSWORD_LABELS.successToast);
      router.push("/admin/dashboard");
    } catch (cause) {
      setSubmitError(
        cause instanceof Error
          ? cause.message
          : CHANGE_PASSWORD_LABELS.notChangedErrorFallback,
      );
    }
  });

  return (
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
        id="newPassword"
        label={CHANGE_PASSWORD_LABELS.newPasswordLabel}
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
        id="confirmPassword"
        label={CHANGE_PASSWORD_LABELS.confirmPasswordLabel}
        error={errors.confirmPassword?.message}
        required
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
      </Field>

      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" />
            {CHANGE_PASSWORD_LABELS.submitPending}
          </>
        ) : (
          CHANGE_PASSWORD_LABELS.submitIdle
        )}
      </Button>
    </form>
  );
}
