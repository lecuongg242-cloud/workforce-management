"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { Field } from "@/components/forms/field";
import { FormSection, FormFieldFull } from "@/components/forms/form-section";
import { StickyFormActions } from "@/components/forms/sticky-form-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CONTRACT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  PAY_RATE_LABEL,
  PAY_RATE_UNIT_OPTIONS,
  PAY_RATE_UNIT_SUFFIX,
  SYSTEM_ROLE_OPTIONS,
  WEEKDAY_OPTIONS,
  WORK_LOCATION_OPTIONS,
} from "@/lib/constants";
import { createEmployee, updateEmployee } from "@/lib/data/employees";
import { createPayRate } from "@/lib/data/pay-rates";
import { useDataStore } from "@/lib/data/store";
import { formatDuration } from "@/lib/format";
import {
  MAX_SHIFT_HOURS,
  MIN_SHIFT_HOURS,
  formatShiftLabel,
  hoursToMinutes,
  minutesToHours,
} from "@/lib/shifts/schedule";
import type {
  Department,
  Employee,
  Shift,
  WeekdayNumber,
} from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import {
  UNSET,
  employeeSchema,
  type EmployeeFormValues,
} from "@/lib/validation/schemas";

/** Nhan cua muc "chua khai" o cac o chon khong bat buoc (migration 0028). */
const UNSET_LABEL = "Chưa khai";
const OPTIONAL_HINT = "Không bắt buộc.";

/**
 * Lich mac dinh khi PHAI tao mot ca linh hoat moi — cung gia tri ma man hinh
 * tao ca (`shift-dialog.tsx`) va buoc onboarding dang dung, khong phai mot con
 * so rieng cua man hinh nay.
 */
const DEFAULT_WORKING_DAYS: WeekdayNumber[] = [1, 2, 3, 4, 5];

/**
 * O de trong -> `null`. Cat khoang trang truoc khi xet: mot o chi chua dau cach
 * la mot o TRONG, khong phai mot chuc vu ten la " ".
 */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Sinh ma nhan vien tiep theo dua tren ma lon nhat hien co */
function suggestCode(employees: Employee[]): string {
  const numbers = employees
    .map((employee) => Number(employee.code.replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value));
  const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  return `NV${`${next}`.padStart(3, "0")}`;
}

export function EmployeeForm({
  mode,
  companyId,
  employee,
  departments,
  shifts,
  allEmployees,
  defaultStartDate,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  companyId: string;
  employee?: Employee;
  departments: Department[];
  shifts: Shift[];
  allEmployees: Employee[];
  defaultStartDate: string;
  /**
   * Chi dung o `mode="edit"`. Khi bieu mau nam trong mot hop thoai, luu xong
   * phai DONG hop thoai — dieu huong sang chinh trang dang dung khong dong
   * duoc gi, va nguoi dung ngoi nhin mot bieu mau da luu roi.
   *
   * Nhan HO SO DA LUU: noi mo bieu mau can biet ca MOI la ca nao de quyet dinh
   * co hoi "ap ca linh hoat cho ky chua chot" hay khong. Doc lai tu kho du lieu
   * o do se dua vao thoi diem `invalidate()` keo xong — mot cuoc dua khong can
   * thiet khi con so dung da nam ngay day.
   */
  onSaved?: (employee: Employee) => void;
  /**
   * DOI XUNG voi `onSaved`, va vi dung mot ly do: bieu mau nay song o HAI ngu
   * canh — mot trang rieng (`/admin/employees/new`) va mot hop thoai (nut
   * "Chỉnh sửa" o ho so nhan vien). "Huy" o trang rieng nghia la ROI TRANG;
   * "Huy" trong hop thoai nghia la DONG HOP THOAI, va chi the thoi.
   *
   * Truoc khi co prop nay, duong huy luon dieu huong — nen bam "Hủy" trong hop
   * thoai vua dong hop thoai vua nem nguoi dung ra khoi trang ho so ho dang
   * xem. `onSaved` da tach hai ngu canh nay o duong LUU tu truoc; day la phan
   * con thieu cua chinh su tach do o duong HUY.
   */
  onCancel?: () => void;
}): React.ReactElement {
  const router = useRouter();
  const { invalidate } = useDataStore();
  const [confirmLeave, setConfirmLeave] = React.useState(false);

  // Muc luong CHI khai o man hinh them moi. O man hinh sua, doi luong la mot
  // PHIEN BAN MOI voi ngay hieu luc rieng va di qua tab "Thông tin lương"
  // (D-37a) — de o day se thanh mot duong ghi thu hai cho cung mot so lieu.
  const isCreate = mode === "create";

  // Ca dang gan cua nguoi nay la ca linh hoat hay ca co gio cu the? Suy tu
  // chinh ca do, khong luu them mot co o `employees`: mot co nhu vay se lech
  // duoc khoi ca that sau mot lan sua ca.
  const currentShift = employee
    ? shifts.find((item) => item.id === employee.shiftId)
    : undefined;

  const defaultValues: EmployeeFormValues = React.useMemo(
    () =>
      employee
        ? {
            fullName: employee.fullName,
            code: employee.code,
            email: employee.email,
            phone: employee.phone ?? "",
            dateOfBirth: employee.dateOfBirth ?? "",
            gender: employee.gender ?? UNSET,
            avatarUrl: employee.avatarUrl,
            departmentId: employee.departmentId ?? "",
            position: employee.position ?? "",
            contractType: employee.contractType ?? UNSET,
            startDate: employee.startDate,
            managerId: employee.managerId,
            shiftMode: currentShift?.kind === "hours" ? "hours" : "shift",
            shiftId: employee.shiftId,
            dailyHours:
              currentShift?.durationMinutes != null
                ? minutesToHours(currentShift.durationMinutes)
                : null,
            shiftWorkingDays: currentShift?.workingDays ?? DEFAULT_WORKING_DAYS,
            workLocation: employee.workLocation,
            status: employee.status,
            systemRole: employee.systemRole,
            invitationSent: employee.invitationSent,
            canViewPayslip: employee.canViewPayslip,
            canCheckInRemotely: employee.canCheckInRemotely,
            payRateRequired: false,
            payRateUnit: "month",
            payRateAmount: null,
            payRateEffectiveFrom: defaultStartDate,
          }
        : {
            fullName: "",
            code: suggestCode(allEmployees),
            email: "",
            phone: "",
            dateOfBirth: "",
            // KHONG mac dinh "male": mot gia tri chon san o o khong bat buoc se
            // duoc luu nhu mot lua chon that ma khong ai tung bam vao no.
            gender: UNSET,
            avatarUrl: null,
            departmentId: departments[0]?.id ?? "",
            position: "",
            contractType: UNSET,
            startDate: defaultStartDate,
            managerId: null,
            shiftMode: "shift",
            shiftId: shifts[0]?.id ?? "",
            dailyHours: null,
            shiftWorkingDays: DEFAULT_WORKING_DAYS,
            workLocation: WORK_LOCATION_OPTIONS[0].value,
            status: "pending_invite",
            systemRole: "employee",
            invitationSent: true,
            canViewPayslip: true,
            canCheckInRemotely: false,
            payRateRequired: true,
            // Don vi CO mac dinh — do la mot don vi do, khong phai mot muc gia.
            // So tien thi KHONG (D-26): mot con so dien san la mot cach ngam de
            // xuat rang he thong biet truoc muc doanh nghiep nen tra.
            payRateUnit: "month",
            payRateAmount: null,
            payRateEffectiveFrom: defaultStartDate,
          },
    [employee, currentShift, departments, shifts, allEmployees, defaultStartDate],
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues,
  });

  const fullName = watch("fullName");
  const shiftMode = watch("shiftMode");
  const dailyHours = watch("dailyHours");
  const shiftWorkingDays = watch("shiftWorkingDays");
  const payRateUnit = watch("payRateUnit");
  const payRateEffectiveFrom = watch("payRateEffectiveFrom");
  const isHoursMode = shiftMode === "hours";
  const managers = allEmployees.filter(
    (item) => item.systemRole !== "employee" && item.id !== employee?.id,
  );

  const toggleWorkingDay = (day: WeekdayNumber): void => {
    const next = shiftWorkingDays.includes(day)
      ? shiftWorkingDays.filter((item) => item !== day)
      : [...shiftWorkingDays, day].sort((a, b) => a - b);
    setValue("shiftWorkingDays", next, { shouldValidate: true, shouldDirty: true });
  };

  /**
   * Tach cac o CHI THUOC VE bieu mau ra khoi du lieu ghi vao `employees`:
   * `shiftMode`/`dailyHours`/`shiftWorkingDays` di sang tham so `hoursShift`,
   * bon o `payRate*` di sang mot loi goi rieng. Gui thang ca cuc `values` nhu
   * truoc se day nhung khoa nay xuong duong ghi, noi `employeeInputSchema` bo
   * qua chung — im lang, va vi vay khong ai phat hien khi mot o dang le phai
   * duoc luu lai khong duoc luu.
   */
  const toEmployeeInput = (values: EmployeeFormValues) => ({
    fullName: values.fullName,
    code: values.code,
    email: values.email,
    // NOI DUY NHAT doi "de trong" cua bieu mau thanh `null` cua database
    // (migration 0028). Chuoi rong va `UNSET` deu co nghia CHUA KHAI, nhung chi
    // `null` mang duoc nghia do xuong toi noi luu: mot chuoi rong nam trong cot
    // `position` se khop voi mot pham vi phu cap khai chuc vu rong, va mot
    // `gender` bang "__unset__" thi khong con la enum nghiep vu nua.
    phone: blankToNull(values.phone),
    dateOfBirth: blankToNull(values.dateOfBirth),
    gender: values.gender === UNSET ? null : values.gender,
    avatarUrl: values.avatarUrl,
    departmentId: blankToNull(values.departmentId),
    position: blankToNull(values.position),
    contractType: values.contractType === UNSET ? null : values.contractType,
    startDate: values.startDate,
    managerId: values.managerId,
    // O che do `hours`, gia tri nay bi tham so `hoursShift` de len tren o tang
    // mutation — giu lai de ho so KHONG BAO GIO co `shiftId` rong neu nguoi
    // dung doi qua doi lai giua hai che do.
    shiftId: values.shiftId,
    workLocation: values.workLocation,
    status: values.status,
    systemRole: values.systemRole,
    invitationSent: values.invitationSent,
    canViewPayslip: values.canViewPayslip,
    canCheckInRemotely: values.canCheckInRemotely,
  });

  const toHoursShift = (values: EmployeeFormValues) =>
    values.shiftMode === "hours" && values.dailyHours !== null
      ? { hours: values.dailyHours, workingDays: values.shiftWorkingDays }
      : null;

  const submit = handleSubmit(async (values) => {
    try {
      if (mode === "create") {
        const created = await createEmployee(
          companyId,
          toEmployeeInput(values),
          toHoursShift(values),
        );

        // Muc luong la mot loi goi RIENG, chay SAU khi da co ho so: `pay_rates`
        // tham chieu `employee_id`, nen khong co cach nao ghi truoc. Neu buoc
        // nay hong thi ho so DA duoc tao — noi ro dieu do va chi sang noi khai
        // lai, thay vi mot cau "khong luu duoc" khien nguoi dung them nguoi lan
        // thu hai va nhan loi trung ma nhan vien.
        try {
          await createPayRate({
            employeeId: created.id,
            unit: values.payRateUnit,
            amount: values.payRateAmount as number,
            effectiveFrom: values.payRateEffectiveFrom,
          });
        } catch (payRateCause) {
          invalidate();
          toast.error("Đã thêm nhân viên nhưng chưa lưu được mức lương", {
            description: `${
              payRateCause instanceof Error
                ? payRateCause.message
                : PAY_RATE_LABEL.saveError
            } Hãy khai lại ở tab “${PAY_RATE_LABEL.sectionTitle}”.`,
          });
          router.push(`/admin/employees/${created.id}`);
          return;
        }

        invalidate();
        toast.success("Đã thêm nhân viên", {
          description: `${created.fullName} (${created.code}) đã có trong danh sách.`,
        });
        router.push("/admin/employees");
      } else if (employee) {
        const updated = await updateEmployee(
          employee.id,
          toEmployeeInput(values),
          toHoursShift(values),
        );
        invalidate();
        toast.success("Đã lưu thay đổi", {
          description: `Thông tin của ${values.fullName} đã được cập nhật.`,
        });
        // `invalidate()` o tren da keo lai du lieu moi, nen khong can dieu huong
        // de lam moi man hinh — chi can tra quyen dieu khien ve cho noi mo
        // bieu mau.
        if (onSaved) onSaved(updated);
        else router.push(`/admin/employees/${employee.id}`);
      }
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không lưu được nhân viên.",
      );
    }
  });

  /**
   * Roi bo bieu mau — MOT dinh nghia duy nhat cho ca hai ngu canh, dung o ca
   * nut "Hủy" lan nut xac nhan cua hop thoai "chua luu". Hai noi goi phai lam
   * DUNG mot viec: neu chung khac nhau thi bam "Hủy" khi sach se dong hop
   * thoai, con bam "Hủy" khi ban se dieu huong — cung mot nut, hai ket qua.
   */
  const leaveForm = (): void => {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push("/admin/employees");
  };

  const handleCancel = (): void => {
    if (isDirty) {
      setConfirmLeave(true);
      return;
    }
    leaveForm();
  };

  return (
    <form onSubmit={submit} noValidate>
      <FormSection
        title="Thông tin cá nhân"
        description="Thông tin dùng để nhận diện nhân viên trên bảng công và phiếu lương."
      >
        <FormFieldFull>
          <div className="flex items-center gap-4">
            <EmployeeAvatar name={fullName || "?"} size="lg" />
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.info("Tải ảnh đại diện sẽ khả dụng khi kết nối máy chủ.")
                }
              >
                <ImagePlus aria-hidden="true" />
                Tải ảnh đại diện
              </Button>
              <p className="mt-1.5 text-xs text-ink-muted">
                Định dạng JPG hoặc PNG, dung lượng tối đa 2 MB.
              </p>
            </div>
          </div>
        </FormFieldFull>

        <Field
          id="fullName"
          label="Họ và tên"
          error={errors.fullName?.message}
          required
        >
          <Input placeholder="Nguyễn Minh Anh" {...register("fullName")} />
        </Field>

        <Field
          id="code"
          label="Mã nhân viên"
          error={errors.code?.message}
          required
        >
          <Input className="num" placeholder="NV029" {...register("code")} />
        </Field>

        <Field id="email" label="Email" error={errors.email?.message} required>
          <Input type="email" placeholder="ten@congty.vn" {...register("email")} />
        </Field>

        <Field
          id="phone"
          label="Số điện thoại"
          error={errors.phone?.message}
          hint={OPTIONAL_HINT}
        >
          <Input
            type="tel"
            inputMode="tel"
            className="num"
            placeholder="0912345678"
            {...register("phone")}
          />
        </Field>

        <Field
          id="dateOfBirth"
          label="Ngày sinh"
          error={errors.dateOfBirth?.message}
          hint={OPTIONAL_HINT}
        >
          <Input type="date" className="num" {...register("dateOfBirth")} />
        </Field>

        <Field id="gender" label="Giới tính" error={errors.gender?.message}>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{UNSET_LABEL}</SelectItem>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Thông tin công việc"
        description="Quyết định ca làm việc mặc định và cách tính công hằng ngày."
      >
        <Field
          id="departmentId"
          label="Phòng ban"
          error={errors.departmentId?.message}
          hint="Chưa xếp phòng ban thì nhân viên không nhận phụ cấp hay khấu trừ khai theo phòng ban."
        >
          <Controller
            control={control}
            name="departmentId"
            render={({ field }) => (
              <Select
                // Chuoi rong KHONG dung lam `value` cua Radix Select duoc — no
                // doc ra thanh "chua chon gi" va quay ve placeholder, nen muc
                // "Chưa xếp" se khong bao gio chon duoc. Dung CHUNG moc `UNSET`
                // voi hai o chon kia, roi doi lai thanh chuoi rong ngay tai
                // `onValueChange` de phan con lai cua bieu mau khong phai biet.
                value={field.value === "" ? UNSET : field.value}
                onValueChange={(value) =>
                  field.onChange(value === UNSET ? "" : value)
                }
              >
                <SelectTrigger id="departmentId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{UNSET_LABEL}</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field
          id="position"
          label="Chức vụ"
          error={errors.position?.message}
          hint="Chưa khai chức vụ thì nhân viên không nhận phụ cấp hay khấu trừ khai theo chức vụ."
        >
          <Input placeholder="Nhân viên kinh doanh" {...register("position")} />
        </Field>

        <Field
          id="contractType"
          label="Loại hợp đồng"
          error={errors.contractType?.message}
          hint={OPTIONAL_HINT}
        >
          <Controller
            control={control}
            name="contractType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="contractType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{UNSET_LABEL}</SelectItem>
                  {CONTRACT_TYPE_OPTIONS.map((option) => (
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
          id="startDate"
          label="Ngày bắt đầu"
          error={errors.startDate?.message}
          required
        >
          <Input type="date" className="num" {...register("startDate")} />
        </Field>

        <Field id="managerId" label="Quản lý trực tiếp">
          <Controller
            control={control}
            name="managerId"
            render={({ field }) => (
              <Select
                value={field.value ?? "none"}
                onValueChange={(value) =>
                  field.onChange(value === "none" ? null : value)
                }
              >
                <SelectTrigger id="managerId" className="w-full">
                  <SelectValue placeholder="Chọn quản lý" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không có</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        {/* CA LAM MAC DINH — hai cach khai loai tru nhau (migration 0027).
            O chon nay quyet dinh o nao hien ben duoi, nen no dung mot minh
            mot dong thay vi nam trong luoi hai cot. */}
        <FormFieldFull>
          <Field id="shiftMode" label="Ca làm mặc định" required>
            <Controller
              control={control}
              name="shiftMode"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as EmployeeFormValues["shiftMode"])
                  }
                >
                  <SelectTrigger id="shiftMode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shift">
                      Chọn một ca có giờ vào, giờ ra
                    </SelectItem>
                    <SelectItem value="hours">
                      Theo số giờ — linh hoạt, không cố định giờ
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </FormFieldFull>

        {isHoursMode ? (
          <>
            <Field
              id="dailyHours"
              label="Số giờ làm một ngày"
              error={errors.dailyHours?.message}
              hint={
                dailyHours
                  ? `Làm đủ ${formatDuration(hoursToMinutes(dailyHours))} là một ngày công. Không tính đi muộn, về sớm.`
                  : "Ví dụ 10 nghĩa là một ngày công của người này dài 10 tiếng."
              }
              required
            >
              <Controller
                control={control}
                name="dailyHours"
                render={({ field }) => (
                  <Input
                    id="dailyHours"
                    type="number"
                    step="0.5"
                    min={MIN_SHIFT_HOURS}
                    max={MAX_SHIFT_HOURS}
                    className="num"
                    placeholder="10"
                    value={field.value ?? ""}
                    onChange={(event) =>
                      // O de trong phai ve `null`, khong phai `NaN`: `NaN` di
                      // duoc qua moi phep so sanh so ma khong kich hoat cai nao,
                      // nen mot o trong se lot xuong toi tang ghi.
                      field.onChange(
                        event.target.value === ""
                          ? null
                          : event.target.valueAsNumber,
                      )
                    }
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Field>

            <FormFieldFull>
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium text-ink-secondary">
                  Ngày làm việc trong tuần
                  <span className="text-danger" aria-hidden="true">
                    *
                  </span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((option) => {
                    const selected = shiftWorkingDays.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleWorkingDay(option.value)}
                        className={cn(
                          "min-h-10 min-w-10 rounded-full border px-3 text-sm font-medium transition-colors",
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
                {errors.shiftWorkingDays ? (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                    {errors.shiftWorkingDays.message}
                  </p>
                ) : (
                  // Ca linh hoat dung CHUNG cho moi nguoi khai cung so gio, nen
                  // lich cua mot ca da co san khong bi loi goi nay sua — noi ro
                  // de khong ai tuong minh vua doi lich cho rieng mot nguoi.
                  <p className="mt-1.5 text-xs text-ink-muted">
                    Chỉ áp dụng khi hệ thống phải tạo ca linh hoạt mới. Nếu đã có
                    ca cùng số giờ, nhân viên dùng lịch của ca đó.
                  </p>
                )}
              </fieldset>
            </FormFieldFull>
          </>
        ) : (
          <Field
            id="shiftId"
            label="Ca làm việc"
            error={errors.shiftId?.message}
            required
          >
            <Controller
              control={control}
              name="shiftId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="shiftId" className="w-full">
                    <SelectValue placeholder="Chọn ca làm việc" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {formatShiftLabel(shift)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}

        <Field
          id="workLocation"
          label="Địa điểm làm việc"
          error={errors.workLocation?.message}
          required
        >
          <Controller
            control={control}
            name="workLocation"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="workLocation" className="w-full">
                  <SelectValue placeholder="Chọn địa điểm" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_LOCATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </FormSection>

      {/* MUC LUONG — chi o man hinh them moi. O man hinh sua, moi lan doi luong
          la mot PHIEN BAN MOI co ngay hieu luc rieng va di qua tab
          "Thông tin lương" (D-37a); dat lai o day se thanh mot duong ghi thu
          hai cho cung mot so lieu, va bang luong cua ky da tra se doi theo. */}
      {isCreate ? (
        <FormSection
          title={PAY_RATE_LABEL.sectionTitle}
          description="Chưa khai mức lương thì bảng lương không tính ra được con số nào cho nhân viên này."
        >
          <Field
            id="payRateUnit"
            label={PAY_RATE_LABEL.fieldUnit}
            error={errors.payRateUnit?.message}
            required
          >
            <Controller
              control={control}
              name="payRateUnit"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="payRateUnit" className="w-full">
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
            id="payRateAmount"
            label={PAY_RATE_LABEL.fieldAmount}
            error={errors.payRateAmount?.message}
            hint={`Lương gốc theo ${PAY_RATE_UNIT_SUFFIX[payRateUnit]} — chưa gồm phụ cấp, khấu trừ, thuế và bảo hiểm.`}
            required
          >
            <Controller
              control={control}
              name="payRateAmount"
              render={({ field }) => (
                <Input
                  id="payRateAmount"
                  type="number"
                  step="1000"
                  min="1"
                  className="num"
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === ""
                        ? null
                        : event.target.valueAsNumber,
                    )
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>

          <Field
            id="payRateEffectiveFrom"
            label={PAY_RATE_LABEL.fieldEffectiveFrom}
            error={errors.payRateEffectiveFrom?.message}
            required
          >
            <Input
              type="date"
              className="num"
              {...register("payRateEffectiveFrom")}
            />
          </Field>

          {/* Cung canh bao hoi to voi `PayRatePanel` — ngay hieu luc lui ve qua
              khu ap cho ca nhung ngay da qua, va do thuong khong phai y dinh
              khi nguoi dung chi dang sua ngay bat dau lam viec. */}
          {payRateEffectiveFrom && payRateEffectiveFrom < defaultStartDate ? (
            <FormFieldFull>
              <p
                role="alert"
                className="rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-xs text-ink"
              >
                {PAY_RATE_LABEL.retroWarning}
              </p>
            </FormFieldFull>
          ) : null}

          <FormFieldFull>
            <p className="text-xs leading-relaxed text-ink-muted">
              {PAY_RATE_LABEL.appendOnlyNote}
            </p>
          </FormFieldFull>
        </FormSection>
      ) : null}

      <FormSection
        title="Tài khoản"
        description="Quyết định nhân viên đăng nhập được gì trên ứng dụng."
      >
        <Field
          id="systemRole"
          label="Vai trò hệ thống"
          error={errors.systemRole?.message}
          required
        >
          <Controller
            control={control}
            name="systemRole"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="systemRole" className="w-full">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <FormFieldFull className="grid gap-2.5">
          <SwitchRow
            control={control}
            name="invitationSent"
            id="invitationSent"
            label="Gửi lời mời đăng nhập"
            hint="Nhân viên nhận email kích hoạt tài khoản ngay sau khi lưu."
          />
          <SwitchRow
            control={control}
            name="canViewPayslip"
            id="canViewPayslip"
            label="Cho phép xem phiếu lương"
            hint="Khi tính năng bảng lương ra mắt, nhân viên sẽ xem được phiếu lương."
          />
          <SwitchRow
            control={control}
            name="canCheckInRemotely"
            id="canCheckInRemotely"
            label="Cho phép chấm công ngoài địa điểm"
            hint="Dùng cho nhân viên đi thị trường hoặc làm việc từ xa."
          />
        </FormFieldFull>
      </FormSection>

      <StickyFormActions
        hint={
          isDirty ? "Bạn có thay đổi chưa được lưu." : "Chưa có thay đổi nào."
        }
      >
        <Button type="button" variant="ghost" onClick={handleCancel}>
          Hủy
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            toast.success("Đã lưu nháp", {
              description: "Bản nháp được giữ trong phiên làm việc này.",
            })
          }
        >
          Lưu nháp
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin" />
              Đang lưu…
            </>
          ) : mode === "create" ? (
            "Thêm nhân viên"
          ) : (
            "Lưu thay đổi"
          )}
        </Button>
      </StickyFormActions>

      {/* Chu cua hop thoai nay phai NOI DUNG viec sap xay ra. Trong hop thoai
          chinh sua, "Rời khỏi trang" la mot loi hua sai: khong ai roi trang
          nao ca, chi co hop thoai dong lai. */}
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={onCancel ? "Đóng khi chưa lưu?" : "Rời khỏi trang khi chưa lưu?"}
        description="Các thông tin bạn vừa nhập sẽ không được giữ lại."
        confirmLabel={onCancel ? "Đóng, không lưu" : "Rời khỏi trang"}
        tone="destructive"
        onConfirm={() => {
          setConfirmLeave(false);
          leaveForm();
        }}
      />
    </form>
  );
}

function SwitchRow({
  control,
  name,
  id,
  label,
  hint,
}: {
  control: ReturnType<typeof useForm<EmployeeFormValues>>["control"];
  name: "invitationSent" | "canViewPayslip" | "canCheckInRemotely";
  id: string;
  label: string;
  hint: string;
}): React.ReactElement {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start justify-between gap-4 rounded-control border border-hairline px-3.5 py-3">
          <div className="min-w-0">
            <Label htmlFor={id} className="text-[14px] font-medium text-ink">
              {label}
            </Label>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{hint}</p>
          </div>
          <Switch
            id={id}
            checked={field.value}
            onCheckedChange={field.onChange}
            className="mt-0.5"
          />
        </div>
      )}
    />
  );
}
