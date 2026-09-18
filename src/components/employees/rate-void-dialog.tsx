"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { RATE_VOID_LABEL } from "@/lib/constants";

/**
 * Hop thoai HUY MOT DONG KHAI NHAM (D-57), dung chung cho ca muc luong va muc
 * tang ca rieng — hai man hinh noi cung mot chuyen nen phai noi cung mot cau.
 *
 * Ly do BAT BUOC, va nut xac nhan bi chan ngay tai cho khi o ly do con trong:
 * khong de nguoi dung bam xong roi moi nhan mot thong bao loi. Cung khuon voi
 * hop thoai huy chot luong (D-45).
 *
 * Hai canh bao KHONG chan thao tac, chi noi truoc he qua:
 *   - `isInClosedPeriod`: dong nay da di vao mot ky da chot luong. Huy no
 *     khong lam ban chot doi (ban chot chep so tien vao chinh no), va ky do se
 *     KHONG duoc tinh lai — D-57.
 *   - `isLastActive`: huy xong nguoi nay tro ve "chua khai".
 */
export function RateVoidDialog({
  open,
  onOpenChange,
  isInClosedPeriod,
  isLastActive,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInClosedPeriod: boolean;
  isLastActive: boolean;
  isPending: boolean;
  onConfirm: (reason: string) => void;
}): React.ReactElement {
  const [reason, setReason] = React.useState("");

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setReason("");
      }}
      title={RATE_VOID_LABEL.dialogTitle}
      description={
        <div className="grid gap-3">
          <p>{RATE_VOID_LABEL.dialogBody}</p>

          {isInClosedPeriod ? (
            <Warning text={RATE_VOID_LABEL.closedPeriodWarning} />
          ) : null}
          {isLastActive ? (
            <Warning text={RATE_VOID_LABEL.lastActiveWarning} />
          ) : null}

          <div className="grid gap-1.5">
            <label
              htmlFor="rate-void-reason"
              className="text-[13px] font-medium text-ink-secondary"
            >
              {RATE_VOID_LABEL.reasonLabel}
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </label>
            <Textarea
              id="rate-void-reason"
              rows={3}
              value={reason}
              placeholder={RATE_VOID_LABEL.reasonPlaceholder}
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="text-xs text-ink-muted">
              {RATE_VOID_LABEL.reasonRequired}
            </p>
          </div>

          <p className="text-xs text-ink-muted">{RATE_VOID_LABEL.oneWayNote}</p>
        </div>
      }
      confirmLabel={RATE_VOID_LABEL.confirm}
      tone="destructive"
      isPending={isPending}
      // Chan ngay tai nut: khong de nguoi dung bam xong roi moi nhan mot loi.
      confirmDisabled={reason.trim().length === 0}
      onConfirm={() => onConfirm(reason)}
    />
  );
}

function Warning({ text }: { text: string }): React.ReactElement {
  return (
    <div className="flex items-start gap-2 rounded-control border border-hairline bg-canvas-soft px-3 py-2.5">
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-warning"
      />
      <p className="text-xs text-ink-secondary">{text}</p>
    </div>
  );
}
