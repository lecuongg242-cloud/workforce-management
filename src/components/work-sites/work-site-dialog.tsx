"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
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
import type { WorkSite } from "@/lib/types/domain";
import { workSiteFormSchema, type WorkSiteFormValues } from "@/lib/validation/schemas";

const DEFAULT_VALUES: WorkSiteFormValues = {
  name: "",
  latitude: 0,
  longitude: 0,
  radiusMeters: 100,
};

/**
 * Hop thoai tao / sua diem lam viec, cung khuon `ShiftDialog` (02-06).
 * Dung chung cho ca tao moi lan sua — `workSite` khac `null` thi nap lai gia
 * tri hien co khi mo. KHONG co o `isActive` trong form: bat/tat nam o hanh
 * dong "Ngừng sử dụng" rieng tren the (WorkSiteCard), khong phai mot truong
 * nguoi dung tu go trong dialog nay.
 */
export function WorkSiteDialog({
  open,
  onOpenChange,
  workSite,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workSite: WorkSite | null;
  onSubmit: (values: WorkSiteFormValues) => Promise<void>;
}): React.ReactElement {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkSiteFormValues>({
    resolver: zodResolver(workSiteFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  React.useEffect(() => {
    if (!open) return;
    reset(
      workSite
        ? {
            name: workSite.name,
            latitude: workSite.latitude,
            longitude: workSite.longitude,
            radiusMeters: workSite.radiusMeters,
          }
        : DEFAULT_VALUES,
    );
  }, [open, workSite, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {workSite ? "Chỉnh sửa điểm làm việc" : "Thêm điểm làm việc"}
          </DialogTitle>
          <DialogDescription>
            Toạ độ và bán kính dùng để hệ thống tự tính khoảng cách khi nhân
            viên chấm công — bán kính không phải điều kiện chặn chấm công.
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
            id="work-site-form-name"
            label="Tên điểm làm việc"
            error={errors.name?.message}
            required
          >
            <Input placeholder="Văn phòng chính" {...register("name")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="work-site-form-latitude"
              label="Vĩ độ"
              error={errors.latitude?.message}
              required
            >
              <Input
                type="number"
                step="0.000001"
                className="num"
                {...register("latitude", { valueAsNumber: true })}
              />
            </Field>

            <Field
              id="work-site-form-longitude"
              label="Kinh độ"
              error={errors.longitude?.message}
              required
            >
              <Input
                type="number"
                step="0.000001"
                className="num"
                {...register("longitude", { valueAsNumber: true })}
              />
            </Field>
          </div>

          <Field
            id="work-site-form-radius"
            label="Bán kính (mét)"
            error={errors.radiusMeters?.message}
            required
          >
            <Input
              type="number"
              min={1}
              className="num"
              {...register("radiusMeters", { valueAsNumber: true })}
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
              ) : workSite ? (
                "Lưu thay đổi"
              ) : (
                "Thêm điểm làm việc"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
