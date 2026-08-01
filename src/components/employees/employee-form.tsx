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
  SYSTEM_ROLE_OPTIONS,
  WORK_LOCATION_OPTIONS,
} from "@/lib/constants";
import { createEmployee, updateEmployee } from "@/lib/data/employees";
import { useDataStore } from "@/lib/data/store";
import type {
  Department,
  Employee,
  Shift,
} from "@/lib/types/domain";
import {
  employeeSchema,
  type EmployeeFormValues,
} from "@/lib/validation/schemas";

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
}: {
  mode: "create" | "edit";
  companyId: string;
  employee?: Employee;
  departments: Department[];
  shifts: Shift[];
  allEmployees: Employee[];
  defaultStartDate: string;
}): React.ReactElement {
  const router = useRouter();
  const { invalidate } = useDataStore();
  const [confirmLeave, setConfirmLeave] = React.useState(false);

  const defaultValues: EmployeeFormValues = React.useMemo(
    () =>
      employee
        ? {
            fullName: employee.fullName,
            code: employee.code,
            email: employee.email,
            phone: employee.phone,
            dateOfBirth: employee.dateOfBirth,
            gender: employee.gender,
            avatarUrl: employee.avatarUrl,
            departmentId: employee.departmentId,
            position: employee.position,
            contractType: employee.contractType,
            startDate: employee.startDate,
            managerId: employee.managerId,
            shiftId: employee.shiftId,
            workLocation: employee.workLocation,
            status: employee.status,
            systemRole: employee.systemRole,
            invitationSent: employee.invitationSent,
            canViewPayslip: employee.canViewPayslip,
            canCheckInRemotely: employee.canCheckInRemotely,
          }
        : {
            fullName: "",
            code: suggestCode(allEmployees),
            email: "",
            phone: "",
            dateOfBirth: "",
            gender: "male",
            avatarUrl: null,
            departmentId: departments[0]?.id ?? "",
            position: "",
            contractType: "full_time",
            startDate: defaultStartDate,
            managerId: null,
            shiftId: shifts[0]?.id ?? "",
            workLocation: WORK_LOCATION_OPTIONS[0].value,
            status: "pending_invite",
            systemRole: "employee",
            invitationSent: true,
            canViewPayslip: true,
            canCheckInRemotely: false,
          },
    [employee, departments, shifts, allEmployees, defaultStartDate],
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues,
  });

  const fullName = watch("fullName");
  const managers = allEmployees.filter(
    (item) => item.systemRole !== "employee" && item.id !== employee?.id,
  );

  const submit = handleSubmit(async (values) => {
    try {
      if (mode === "create") {
        const created = await createEmployee(companyId, { ...values });
        invalidate();
        toast.success("Đã thêm nhân viên", {
          description: `${created.fullName} (${created.code}) đã có trong danh sách.`,
        });
        router.push("/admin/employees");
      } else if (employee) {
        await updateEmployee(employee.id, values);
        invalidate();
        toast.success("Đã lưu thay đổi", {
          description: `Thông tin của ${values.fullName} đã được cập nhật.`,
        });
        router.push(`/admin/employees/${employee.id}`);
      }
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không lưu được nhân viên.",
      );
    }
  });

  const handleCancel = (): void => {
    if (isDirty) {
      setConfirmLeave(true);
      return;
    }
    router.back();
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
          required
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
          required
        >
          <Input type="date" className="num" {...register("dateOfBirth")} />
        </Field>

        <Field id="gender" label="Giới tính" error={errors.gender?.message} required>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue placeholder="Chọn giới tính" />
                </SelectTrigger>
                <SelectContent>
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
          required
        >
          <Controller
            control={control}
            name="departmentId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="departmentId" className="w-full">
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
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
          required
        >
          <Input placeholder="Nhân viên kinh doanh" {...register("position")} />
        </Field>

        <Field
          id="contractType"
          label="Loại hợp đồng"
          error={errors.contractType?.message}
          required
        >
          <Controller
            control={control}
            name="contractType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="contractType" className="w-full">
                  <SelectValue placeholder="Chọn loại hợp đồng" />
                </SelectTrigger>
                <SelectContent>
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

        <Field
          id="shiftId"
          label="Ca làm mặc định"
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
                      {shift.name} ({shift.startTime}–{shift.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

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

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Rời khỏi trang khi chưa lưu?"
        description="Các thông tin bạn vừa nhập sẽ không được giữ lại."
        confirmLabel="Rời khỏi trang"
        tone="destructive"
        onConfirm={() => {
          setConfirmLeave(false);
          router.push("/admin/employees");
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
