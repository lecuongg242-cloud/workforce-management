"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CircleCheckBig,
  Loader2,
  Mail,
  Network,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { AppLogo } from "@/components/brand/app-logo";
import { GradientMesh } from "@/components/brand/gradient-mesh";
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
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth/session-provider";
import {
  COMPANY_SIZE_LABEL,
  COMPANY_SIZE_OPTIONS,
  INDUSTRY_OPTIONS,
  WEEKDAY_OPTIONS,
} from "@/lib/constants";
import { formatDuration, isOvernight, minutesBetween } from "@/lib/format";
import { createCompany } from "@/lib/mock/service";
import { useMockData } from "@/lib/mock/store";
import type { CompanySize, WeekdayNumber } from "@/lib/types/domain";
import {
  companyStepSchema,
  shiftStepSchema,
  type CompanyStepValues,
  type ShiftStepValues,
} from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Thông tin doanh nghiệp", description: "Tên, mã và quy mô" },
  { title: "Giờ làm mặc định", description: "Ca làm việc chuẩn" },
  { title: "Hoàn tất", description: "Kiểm tra và bắt đầu" },
] as const;

export function OnboardingWizard(): React.ReactElement {
  const router = useRouter();
  const { selectCompany } = useSession();
  const { invalidate } = useMockData();
  const [step, setStep] = React.useState(0);
  const [isFinishing, setIsFinishing] = React.useState(false);

  const companyForm = useForm<CompanyStepValues>({
    resolver: zodResolver(companyStepSchema),
    defaultValues: {
      name: "",
      code: "",
      industry: "",
      size: "11-30",
      phone: "",
      address: "",
    },
  });

  const shiftForm = useForm<ShiftStepValues>({
    resolver: zodResolver(shiftStepSchema),
    defaultValues: {
      name: "Ca hành chính",
      startTime: "08:00",
      endTime: "17:30",
      breakMinutes: 90,
      lateToleranceMinutes: 5,
      workingDays: [1, 2, 3, 4, 5],
    },
  });

  const goNext = async (): Promise<void> => {
    if (step === 0) {
      const valid = await companyForm.trigger();
      if (!valid) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      const valid = await shiftForm.trigger();
      if (!valid) return;
      setStep(2);
    }
  };

  const handleFinish = async (): Promise<void> => {
    setIsFinishing(true);
    try {
      const values = companyForm.getValues();
      const company = await createCompany({
        name: values.name,
        code: values.code.toUpperCase(),
        industry: values.industry,
        size: values.size,
        phone: values.phone,
        address: values.address,
      });
      invalidate();
      // TODO(02-04 Task 2): swap to `await selectCompany(company.id)` khi doi
      // nguon du lieu sang @/lib/data/companies.
      void selectCompany(company.id);
      toast.success("Đã tạo doanh nghiệp thành công", {
        description: `${company.name} đã sẵn sàng để thêm nhân viên.`,
      });
      router.push("/admin/dashboard");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không tạo được doanh nghiệp.",
      );
      setIsFinishing(false);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas-soft">
      {/* Phan chao mung — noi duy nhat trong onboarding dung gradient mesh */}
      <div className="relative overflow-hidden">
        <GradientMesh variant="band" />
        <div className="relative mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
          <AppLogo variant="light" size="md" />
          <h1 className="display-lg mt-6 text-white">
            Thiết lập doanh nghiệp của bạn
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/85">
            Ba bước ngắn để TimeFlow sẵn sàng ghi nhận giờ làm cho đội ngũ của bạn.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pb-14 sm:px-8">
        <StepIndicator current={step} />

        <div className="surface-panel mt-6 p-5 sm:p-7">
          {step === 0 ? (
            <CompanyStep form={companyForm} />
          ) : step === 1 ? (
            <ShiftStep form={shiftForm} />
          ) : (
            <SummaryStep
              company={companyForm.getValues()}
              shift={shiftForm.getValues()}
              onEditCompany={() => setStep(0)}
              onEditShift={() => setStep(1)}
            />
          )}

          <div className="mt-7 flex flex-col-reverse gap-2.5 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
            {step > 0 ? (
              <Button
                variant="outline"
                onClick={() => setStep((current) => current - 1)}
                disabled={isFinishing}
              >
                <ArrowLeft aria-hidden="true" />
                Quay lại
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}

            {step < 2 ? (
              <Button onClick={goNext}>
                Tiếp tục
                <ArrowRight aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={isFinishing}>
                {isFinishing ? (
                  <>
                    <Loader2 aria-hidden="true" className="animate-spin" />
                    Đang tạo…
                  </>
                ) : (
                  <>
                    Vào trang quản trị
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function StepIndicator({ current }: { current: number }): React.ReactElement {
  const progress = ((current + 1) / STEPS.length) * 100;

  return (
    <div className="mt-6">
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((item, index) => {
          const isDone = index < current;
          const isCurrent = index === current;
          return (
            <li
              key={item.title}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-start gap-2.5 rounded-control border bg-white px-3 py-2.5",
                isCurrent
                  ? "border-brand shadow-e1"
                  : "border-hairline",
              )}
            >
              <span
                className={cn(
                  "num inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-medium",
                  isDone
                    ? "bg-success text-white"
                    : isCurrent
                      ? "bg-brand text-white"
                      : "bg-neutral-soft text-ink-muted",
                )}
              >
                {isDone ? (
                  <Check aria-hidden="true" className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] leading-tight font-medium text-ink">
                  {item.title}
                </span>
                <span className="block text-[11px] leading-tight text-ink-muted">
                  {item.description}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={current + 1}
        aria-label={`Bước ${current + 1} trên ${STEPS.length}`}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-hairline"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CompanyStep({
  form,
}: {
  form: ReturnType<typeof useForm<CompanyStepValues>>;
}): React.ReactElement {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  return (
    <div>
      <h2 className="heading-md text-ink">Thông tin doanh nghiệp</h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        Những thông tin này hiển thị trên bảng công và các báo cáo sau này.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            id="company-name"
            label="Tên doanh nghiệp"
            error={errors.name?.message}
            required
          >
            <Input
              placeholder="Công ty TNHH Thương mại Ngọc Phát"
              {...register("name")}
            />
          </Field>
        </div>

        <Field
          id="company-code"
          label="Mã doanh nghiệp"
          hint="Dùng để nhân viên nhập khi đăng nhập lần đầu."
          error={errors.code?.message}
          required
        >
          <Input placeholder="NGOCPHAT" className="uppercase" {...register("code")} />
        </Field>

        <Field
          id="company-industry"
          label="Lĩnh vực"
          error={errors.industry?.message}
          required
        >
          <Select
            value={watch("industry")}
            onValueChange={(value) =>
              setValue("industry", value, { shouldValidate: true })
            }
          >
            <SelectTrigger id="company-industry" className="w-full">
              <SelectValue placeholder="Chọn lĩnh vực" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="company-size"
          label="Quy mô nhân sự"
          hint="Chỉ dùng để gợi ý thiết lập, không giới hạn số nhân viên."
          error={errors.size?.message}
          required
        >
          <Select
            value={watch("size")}
            onValueChange={(value) =>
              setValue("size", value as CompanySize, { shouldValidate: true })
            }
          >
            <SelectTrigger id="company-size" className="w-full">
              <SelectValue placeholder="Chọn quy mô" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="company-phone"
          label="Số điện thoại"
          error={errors.phone?.message}
          required
        >
          <Input
            type="tel"
            inputMode="tel"
            placeholder="0912345678"
            className="num"
            {...register("phone")}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            id="company-address"
            label="Địa chỉ"
            error={errors.address?.message}
            required
          >
            <Textarea
              rows={2}
              placeholder="142 Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh"
              {...register("address")}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ShiftStep({
  form,
}: {
  form: ReturnType<typeof useForm<ShiftStepValues>>;
}): React.ReactElement {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const startTime = watch("startTime");
  const endTime = watch("endTime");
  const breakMinutes = watch("breakMinutes");
  const workingDays = watch("workingDays");

  const overnight = isOvernight(startTime, endTime);
  const totalMinutes = Math.max(
    minutesBetween(startTime, endTime) - (breakMinutes || 0),
    0,
  );

  const toggleDay = (day: WeekdayNumber): void => {
    const next = workingDays.includes(day)
      ? workingDays.filter((item) => item !== day)
      : [...workingDays, day].sort((a, b) => a - b);
    setValue("workingDays", next, { shouldValidate: true });
  };

  return (
    <div>
      <h2 className="heading-md text-ink">Thiết lập giờ làm mặc định</h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        Đây là ca mặc định áp dụng cho nhân viên mới. Bạn có thể thêm ca khác sau.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="shift-name" label="Tên ca" error={errors.name?.message} required>
            <Input placeholder="Ca hành chính" {...register("name")} />
          </Field>
        </div>

        <Field
          id="shift-start"
          label="Giờ bắt đầu"
          error={errors.startTime?.message}
          required
        >
          <Input type="time" className="num" {...register("startTime")} />
        </Field>

        <Field
          id="shift-end"
          label="Giờ kết thúc"
          error={errors.endTime?.message}
          required
        >
          <Input type="time" className="num" {...register("endTime")} />
        </Field>

        <Field
          id="shift-break"
          label="Thời gian nghỉ (phút)"
          error={errors.breakMinutes?.message}
          required
        >
          <Input
            type="number"
            min={0}
            max={240}
            className="num"
            {...register("breakMinutes", { valueAsNumber: true })}
          />
        </Field>

        <Field
          id="shift-late"
          label="Cho phép đi muộn (phút)"
          error={errors.lateToleranceMinutes?.message}
          required
        >
          <Input
            type="number"
            min={0}
            max={60}
            className="num"
            {...register("lateToleranceMinutes", { valueAsNumber: true })}
          />
        </Field>

        <div className="sm:col-span-2">
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink-secondary">
              Ngày làm việc trong tuần
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((option) => {
                const selected = workingDays.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDay(option.value)}
                    className={cn(
                      "min-h-11 min-w-11 rounded-full border px-3 text-sm font-medium transition-colors sm:min-h-10",
                      selected
                        ? "border-brand bg-brand text-white"
                        : "border-hairline bg-white text-ink-secondary hover:bg-canvas-soft",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {errors.workingDays ? (
              <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                {errors.workingDays.message}
              </p>
            ) : null}
          </fieldset>
        </div>
      </div>

      <div className="mt-5 rounded-control border border-hairline bg-canvas-soft px-4 py-3">
        <p className="text-[13px] text-ink-secondary">
          Thời gian làm việc thực tế:{" "}
          <span className="num font-medium text-ink">
            {formatDuration(totalMinutes)}
          </span>{" "}
          mỗi ngày
          {overnight ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-info-border bg-info-soft px-2 py-0.5 text-[11px] font-medium text-info">
              Ca qua đêm
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const CHECKLIST = [
  { icon: UserPlus, label: "Thêm nhân viên", hint: "Nhập danh sách nhân sự hiện có" },
  { icon: Network, label: "Tạo phòng ban", hint: "Phân nhóm để quản lý dễ hơn" },
  { icon: CalendarClock, label: "Thiết lập ca làm", hint: "Bổ sung ca sáng, chiều, đêm" },
  { icon: Mail, label: "Mời nhân viên sử dụng", hint: "Gửi lời mời đăng nhập qua email" },
];

function SummaryStep({
  company,
  shift,
  onEditCompany,
  onEditShift,
}: {
  company: CompanyStepValues;
  shift: ShiftStepValues;
  onEditCompany: () => void;
  onEditShift: () => void;
}): React.ReactElement {
  const industryLabel =
    INDUSTRY_OPTIONS.find((option) => option.value === company.industry)?.label ??
    "—";
  const overnight = isOvernight(shift.startTime, shift.endTime);
  const dayLabels = shift.workingDays
    .map(
      (day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.label ?? "",
    )
    .join(", ");

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <CircleCheckBig aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="heading-md text-ink">Mọi thứ đã sẵn sàng</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Kiểm tra lại thông tin trước khi vào trang quản trị.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-control border border-hairline p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <Building2 aria-hidden="true" className="size-4 text-ink-muted" />
              Doanh nghiệp
            </h3>
            <Button variant="ghost" size="sm" onClick={onEditCompany}>
              Chỉnh sửa
            </Button>
          </div>
          <dl className="grid gap-2 text-[13px]">
            <SummaryRow label="Tên" value={company.name || "—"} />
            <SummaryRow label="Mã" value={company.code.toUpperCase() || "—"} numeric />
            <SummaryRow label="Lĩnh vực" value={industryLabel} />
            <SummaryRow
              label="Quy mô"
              value={COMPANY_SIZE_LABEL[company.size]}
            />
            <SummaryRow label="Điện thoại" value={company.phone || "—"} numeric />
            <SummaryRow label="Địa chỉ" value={company.address || "—"} />
          </dl>
        </section>

        <section className="rounded-control border border-hairline p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <CalendarClock aria-hidden="true" className="size-4 text-ink-muted" />
              Ca làm mặc định
            </h3>
            <Button variant="ghost" size="sm" onClick={onEditShift}>
              Chỉnh sửa
            </Button>
          </div>
          <dl className="grid gap-2 text-[13px]">
            <SummaryRow label="Tên ca" value={shift.name} />
            <SummaryRow
              label="Giờ làm"
              value={`${shift.startTime} – ${shift.endTime}${overnight ? " (qua đêm)" : ""}`}
              numeric
            />
            <SummaryRow
              label="Nghỉ giữa ca"
              value={`${shift.breakMinutes} phút`}
              numeric
            />
            <SummaryRow
              label="Cho phép đi muộn"
              value={`${shift.lateToleranceMinutes} phút`}
              numeric
            />
            <SummaryRow label="Ngày làm việc" value={dayLabels} />
          </dl>
        </section>
      </div>

      <section className="mt-5">
        <h3 className="text-[13px] font-medium text-ink">Việc nên làm tiếp theo</h3>
        <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {CHECKLIST.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.label}
                className="flex items-start gap-2.5 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5"
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-brand">
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                <span>
                  <span className="block text-[13px] leading-tight font-medium text-ink">
                    {item.label}
                  </span>
                  <span className="block text-[11px] leading-tight text-ink-muted">
                    {item.hint}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "text-right font-medium text-ink",
          numeric && "num",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
