"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/auth/session-provider";
import { loginSchema, type LoginFormValues } from "@/lib/validation/schemas";

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const { signIn } = useSession();
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "quan.nguyen@ngocphat.vn",
      password: "timeflow2026",
      remember: true,
    },
  });

  const remember = watch("remember");

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signIn(values.email, values.password);
      // middleware.ts + getSessionContext() quyet dinh phan con lai: nguoi
      // co nhieu membership se bi dua toi /select-company (NoActiveCompanyError).
      router.push("/admin/dashboard");
    } catch (cause) {
      setSubmitError(
        cause instanceof Error
          ? cause.message
          : "Email hoặc mật khẩu không đúng. Vui lòng thử lại.",
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

      <Field id="email" label="Email" error={errors.email?.message} required>
        <Input
          type="email"
          autoComplete="email"
          placeholder="ten@congty.vn"
          {...register("email")}
        />
      </Field>

      {/* Bo cuc tuong doi de dat nut hien/an mat khau, nhung <label htmlFor>
          van tro thang toi the <input> ben trong Field */}
      <div className="relative">
        <Field
          id="password"
          label="Mật khẩu"
          error={errors.password?.message}
          required
        >
          <Input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            className="pr-10"
            {...register("password")}
          />
        </Field>
        <button
          type="button"
          aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          onClick={() => setShowPassword((current) => !current)}
          className="absolute top-[34px] right-2 inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-canvas-soft hover:text-ink"
        >
          {showPassword ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(checked) =>
              setValue("remember", checked === true, { shouldDirty: true })
            }
          />
          <Label htmlFor="remember" className="text-[13px] text-ink-secondary">
            Ghi nhớ đăng nhập
          </Label>
        </div>
        <Link
          href="/login"
          className="rounded-sm text-[13px] font-medium text-brand hover:underline"
        >
          Quên mật khẩu?
        </Link>
      </div>

      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" />
            Đang đăng nhập…
          </>
        ) : (
          "Đăng nhập"
        )}
      </Button>

      <p className="text-center text-[13px] text-ink-muted">
        Chưa có tài khoản?{" "}
        <Link
          href="/onboarding"
          className="rounded-sm font-medium text-brand hover:underline"
        >
          Tạo tài khoản doanh nghiệp
        </Link>
      </p>
    </form>
  );
}
