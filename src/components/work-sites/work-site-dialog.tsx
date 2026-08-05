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
import {
  WorkSiteMapPicker,
  type MapPosition,
} from "@/components/work-sites/work-site-map-picker";
import type { WorkSite } from "@/lib/types/domain";
import { workSiteFormSchema, type WorkSiteFormValues } from "@/lib/validation/schemas";

const DEFAULT_VALUES: WorkSiteFormValues = {
  name: "",
  latitude: 0,
  longitude: 0,
  radiusMeters: 100,
};

/**
 * (0, 0) la gia tri khoi tao cua bieu mau, khong phai mot diem lam viec that
 * (no nam giua vinh Guinea) — dung no lam dau hieu "chua chon vi tri" de ban
 * do mo o muc toan quoc va de chan luc gui.
 */
function hasPickedPosition(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (latitude !== 0 || longitude !== 0)
  );
}

/**
 * Hop thoai tao / sua diem lam viec, cung khuon `ShiftDialog` (02-06).
 * Dung chung cho ca tao moi lan sua — `workSite` khac `null` thi nap lai gia
 * tri hien co khi mo. KHONG co o `isActive` trong form: bat/tat nam o hanh
 * dong "Ngừng sử dụng" rieng tren the (WorkSiteCard), khong phai mot truong
 * nguoi dung tu go trong dialog nay.
 *
 * Ban do va hai o toa do dong bo HAI CHIEU: chon tren ban do thi hai o doi
 * theo, go tay vao hai o thi ghim doi theo. Giu lai hai o vi day van la cach
 * duy nhat de dan toa do chinh xac co san tu noi khac.
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
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WorkSiteFormValues>({
    resolver: zodResolver(workSiteFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const latitude = watch("latitude");
  const longitude = watch("longitude");
  const radiusMeters = watch("radiusMeters");
  const hasPosition = hasPickedPosition(latitude, longitude);

  const handlePick = React.useCallback(
    (position: MapPosition): void => {
      setValue("latitude", position.latitude, { shouldDirty: true });
      setValue("longitude", position.longitude, { shouldDirty: true });
      clearErrors(["latitude", "longitude"]);
    },
    [setValue, clearErrors],
  );

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
      {/* Ban do lam hop thoai cao them — cho phep cuon de khong tran khoi man
          hinh laptop thap. */}
      <DialogContent className="max-h-[calc(100dvh-3rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {workSite ? "Chỉnh sửa điểm làm việc" : "Thêm điểm làm việc"}
          </DialogTitle>
          <DialogDescription>
            Chọn vị trí trên bản đồ. Toạ độ và bán kính dùng để hệ thống tự
            tính khoảng cách khi nhân viên chấm công — bán kính không phải điều
            kiện chặn chấm công.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(async (values) => {
            // Zod chap nhan (0, 0) vi do van la mot toa do hop le — nhung o
            // day no chi co nghia "chua chon", nen chan rieng tai bieu mau
            // thay vi noi rong schema (schema con phai khop voi
            // `workSiteInputSchema` phia API).
            if (!hasPickedPosition(values.latitude, values.longitude)) {
              setError("latitude", {
                message: "Vui lòng chọn vị trí trên bản đồ.",
              });
              return;
            }
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

          {/* Radix go bo noi dung hop thoai khi dong, nen ban do duoc tao lai
              moi lan mo — khong con ban do cu giu toa do cua diem truoc. */}
          <WorkSiteMapPicker
            latitude={latitude}
            longitude={longitude}
            radiusMeters={
              Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : 0
            }
            hasPosition={hasPosition}
            onPick={handlePick}
          />

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
