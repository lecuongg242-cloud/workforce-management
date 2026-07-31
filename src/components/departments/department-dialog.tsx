"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { DEPARTMENT_STATUS_OPTIONS } from "@/lib/constants";
import type { Department, DepartmentStatus, Employee } from "@/lib/types/domain";
import {
  departmentSchema,
  type DepartmentFormValues,
} from "@/lib/validation/schemas";

/** Hop thoai them / sua phong ban */
export function DepartmentDialog({
  open,
  onOpenChange,
  department,
  employees,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bo trong nghia la them moi */
  department: Department | null;
  employees: Employee[];
  onSubmit: (values: DepartmentFormValues) => Promise<void>;
}): React.ReactElement {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      description: "",
      managerId: null,
      status: "active",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    reset(
      department
        ? {
            name: department.name,
            description: department.description,
            managerId: department.managerId,
            status: department.status,
          }
        : { name: "", description: "", managerId: null, status: "active" },
    );
  }, [open, department, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {department ? "Chỉnh sửa phòng ban" : "Thêm phòng ban"}
          </DialogTitle>
          <DialogDescription>
            {department
              ? "Cập nhật thông tin phòng ban và người quản lý."
              : "Tạo phòng ban mới để phân nhóm nhân viên."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
          })}
          noValidate
          className="grid gap-4"
        >
          <Field
            id="department-name"
            label="Tên phòng ban"
            error={errors.name?.message}
            required
          >
            <Input placeholder="Kinh doanh" {...register("name")} />
          </Field>

          <Field
            id="department-description"
            label="Mô tả"
            hint="Ngắn gọn về chức năng chính của phòng ban."
            error={errors.description?.message}
          >
            <Textarea
              rows={3}
              placeholder="Phát triển khách hàng, chăm sóc đại lý…"
              {...register("description")}
            />
          </Field>

          <Field id="department-manager" label="Người quản lý">
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
                  <SelectTrigger id="department-manager" className="w-full">
                    <SelectValue placeholder="Chọn người quản lý" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Chưa phân công</SelectItem>
                    {employees
                      .filter((employee) => employee.status !== "terminated")
                      .map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.fullName} — {employee.position}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field id="department-status" label="Trạng thái" required>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as DepartmentStatus)
                  }
                >
                  <SelectTrigger id="department-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  Đang lưu…
                </>
              ) : department ? (
                "Lưu thay đổi"
              ) : (
                "Thêm phòng ban"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
