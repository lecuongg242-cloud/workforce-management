"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { AlertTriangle, Info } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  capUsageSummary,
  isOverCap,
  requestedOvertimeHours,
} from "@/lib/attendance/overtime-cap";
import {
  OVERTIME_CAP_LABEL,
  REQUEST_REVIEW_LABEL,
  REQUEST_TYPE_LABEL,
} from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/format";
import type {
  OvertimeUsage,
  RequestEffect,
  ReviewDecision,
  WorkRequest,
} from "@/lib/types/domain";

/**
 * Hop thoai duyet / tu choi mot yeu cau (APRV-02).
 *
 * HAI SCHEMA, MOT O NHAP: khi tu choi, `note` bat buoc; khi duyet, tuy chon.
 * Doi schema theo quyet dinh (thay vi mot schema noi long roi kiem tay) de
 * thong bao loi hien ngay duoi o nhap theo dung khuon cua moi bieu mau khac.
 *
 * Lop nay chi la TIEN NGHI. Cho duy nhat viec bat buoc ly do co hieu luc that
 * la Server Action `reviewRequest()` — mot client sua duoc thi bo qua duoc
 * form nay (T-05-01-05), va rang buoc CHECK cua migration 0017 la lop thu ba.
 */

const approveSchema = z.object({
  note: z.string().max(500, "Ghi chú tối đa 500 ký tự.").optional(),
});

const rejectSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, REQUEST_REVIEW_LABEL.reasonRequired)
    .max(500, "Lý do tối đa 500 ký tự."),
});

export interface ReviewDialogValues {
  note?: string;
}

export function ReviewDialog({
  open,
  onOpenChange,
  request,
  decision,
  effect,
  effectLoading = false,
  overtimeUsage,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: WorkRequest | null;
  decision: ReviewDecision;
  /** Tac dong SE xay ra neu duyet, do server dem (`tf_preview_request_effect`). */
  effect?: RequestEffect | null;
  effectLoading?: boolean;
  /** Gio tang ca da dung + tran cua doanh nghiep (SET-05); chi co voi loai `overtime`. */
  overtimeUsage?: OvertimeUsage | null;
  onSubmit: (values: ReviewDialogValues) => Promise<void>;
}): React.ReactElement {
  const isReject = decision === "rejected";

  // SET-05. `capUsage` la `null` khi: khong phai yeu cau tang ca, dang tu choi,
  // hoac chua doc duoc so lieu — ca ba deu KHONG hien khoi canh bao nao.
  const requestedHours = request
    ? requestedOvertimeHours(request.fromTime, request.toTime)
    : 0;
  const capUsage =
    !isReject && request?.type === "overtime" && overtimeUsage
      ? capUsageSummary({
          usedHours: overtimeUsage.usedHours,
          requestedHours,
          capHours: overtimeUsage.capHours,
        })
      : null;
  // Nut duyet doi CHU khi vuot tran — de cai bam la mot quyet dinh chu khong
  // phai mot phan xa. No van bam duoc: SET-05 la canh bao, khong phai gioi han
  // cung (xem <prohibitions> cua plan 05-03).
  const approvingOverCap =
    capUsage !== null &&
    isOverCap({
      usedHours: overtimeUsage?.usedHours ?? 0,
      requestedHours,
      capHours: overtimeUsage?.capHours ?? null,
    });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReviewDialogValues>({
    resolver: zodResolver(isReject ? rejectSchema : approveSchema),
    defaultValues: { note: "" },
  });

  React.useEffect(() => {
    if (open) reset({ note: "" });
  }, [open, decision, request?.id, reset]);

  const range =
    request === null
      ? ""
      : request.fromDate === request.toDate
        ? formatDate(request.fromDate)
        : `${formatDate(request.fromDate)} – ${formatDate(request.toDate)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isReject
              ? REQUEST_REVIEW_LABEL.rejectTitle
              : REQUEST_REVIEW_LABEL.approveTitle}
          </DialogTitle>
          <DialogDescription>
            {isReject
              ? REQUEST_REVIEW_LABEL.rejectDescription
              : REQUEST_REVIEW_LABEL.approveDescription}
          </DialogDescription>
        </DialogHeader>

        {request ? (
          <dl className="grid gap-1.5 rounded-control border border-hairline bg-canvas-soft p-3 text-[13px]">
            <div className="flex gap-2">
              <dt className="text-ink-muted">Nhân viên:</dt>
              <dd className="text-ink">
                {request.employeeName ?? request.employeeId}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-muted">Loại yêu cầu:</dt>
              <dd className="text-ink">{REQUEST_TYPE_LABEL[request.type]}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-muted">Khoảng ngày:</dt>
              <dd className="num text-ink">{range}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-muted">Lý do của nhân viên:</dt>
              <dd className="text-ink">{request.reason}</dd>
            </div>
          </dl>
        ) : null}

        {/* Xem truoc tac dong — CHI khi duyet. Tu choi khong dong toi du lieu
            cong nen mot con so o day se chi lam nhieu. */}
        {!isReject && request ? (
          <div className="grid gap-2">
            {request.type === "overtime" ? (
              // D-31: khong noi ro dieu nay thi nguoi duyet se tuong minh vua
              // ghi nhan so gio ghi trong don.
              <p className="flex gap-2 rounded-control border border-info-border bg-info-soft p-3 text-[13px] text-info">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  Duyệt tăng ca là <strong>cho phép làm thêm</strong>. Số giờ
                  tăng ca vẫn tính từ dữ liệu chấm công thật, không lấy từ số
                  giờ ghi trong đơn.
                </span>
              </p>
            ) : null}

            {/* SET-05 — canh bao vuot tran. Khong co tran (`capHours` null) thi
                khong co khoi nao: khong nguong thi khong co gi de vuot, va noi
                "khong gioi han" o moi lan duyet chi lam nhieu. */}
            {capUsage?.isOver ? (
              <div className="rounded-control border border-warning-border bg-warning-soft p-3 text-[13px] text-warning">
                <p className="flex gap-2 font-medium">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  {OVERTIME_CAP_LABEL.warningTitle}
                </p>
                {/* Bon con so THAT — mot canh bao khong co so la mot canh bao
                    nguoi ta bam qua. */}
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  <dt>{OVERTIME_CAP_LABEL.usedLabel}</dt>
                  <dd className="num text-right font-medium">
                    {formatNumber(capUsage.usedHours)} {OVERTIME_CAP_LABEL.hourUnit}
                  </dd>
                  <dt>{OVERTIME_CAP_LABEL.requestedLabel}</dt>
                  <dd className="num text-right font-medium">
                    {formatNumber(capUsage.requestedHours)}{" "}
                    {OVERTIME_CAP_LABEL.hourUnit}
                  </dd>
                  <dt>{OVERTIME_CAP_LABEL.capLabel}</dt>
                  <dd className="num text-right font-medium">
                    {formatNumber(capUsage.capHours ?? 0)}{" "}
                    {OVERTIME_CAP_LABEL.hourUnit}
                  </dd>
                  <dt className="font-medium">{OVERTIME_CAP_LABEL.overLabel}</dt>
                  <dd className="num text-right font-semibold">
                    {formatNumber(capUsage.overHours)} {OVERTIME_CAP_LABEL.hourUnit}
                  </dd>
                </dl>
              </div>
            ) : null}

            {request.type === "overtime" ? null : effectLoading ? (
              <Skeleton className="h-12 w-full rounded-control" />
            ) : effect ? (
              <div className="grid gap-2">
                <p className="rounded-control border border-hairline bg-canvas-soft p-3 text-[13px] text-ink-secondary">
                  Duyệt xong sẽ{" "}
                  <span className="num font-medium text-ink">
                    tạo {effect.insertedCount} bản ghi công
                  </span>
                  {effect.updatedCount > 0 ? (
                    <>
                      {" "}và{" "}
                      <span className="num font-medium text-ink">
                        sửa {effect.updatedCount} bản ghi
                      </span>
                    </>
                  ) : null}
                  .
                </p>
                {effect.skippedCount > 0 ? (
                  // Mau thuan giua don nghi va du lieu cham cong that. Hien
                  // NOI BAT: nguoi duyet la nguoi duy nhat giai quyet duoc.
                  <p className="flex gap-2 rounded-control border border-warning-border bg-warning-soft p-3 text-[13px] text-warning">
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <span>
                      <strong className="num">
                        {effect.skippedCount} ngày
                      </strong>{" "}
                      sẽ bị bỏ qua vì đã có dữ liệu chấm công:{" "}
                      <span className="num">
                        {effect.skippedDates.map(formatDate).join(", ")}
                      </span>
                      . Nhân viên đã đi làm những ngày đó — bản ghi cũ không bị
                      ghi đè.
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
          })}
          noValidate
          className="grid gap-4"
        >
          <Field
            id="review-dialog-note"
            label={
              isReject
                ? REQUEST_REVIEW_LABEL.reasonLabel
                : REQUEST_REVIEW_LABEL.noteLabel
            }
            error={errors.note?.message}
            required={isReject}
          >
            <Textarea
              rows={3}
              placeholder={
                isReject
                  ? "Ví dụ: trùng lịch kiểm kê cuối quý, đề nghị chọn ngày khác."
                  : "Không bắt buộc."
              }
              {...register("note")}
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
            {/* Nut xac nhan noi ro DANG LAM GI, khong phai "OK". */}
            <Button
              type="submit"
              variant={isReject ? "destructive" : "default"}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  Đang xử lý…
                </>
              ) : isReject ? (
                REQUEST_REVIEW_LABEL.rejectAction
              ) : approvingOverCap ? (
                OVERTIME_CAP_LABEL.approveAnywayAction
              ) : (
                REQUEST_REVIEW_LABEL.approveAction
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
