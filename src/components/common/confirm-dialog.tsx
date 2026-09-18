"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Hop thoai xac nhan dung chung.
 * Radix da xu ly bay focus (focus trap) va dong bang phim Esc.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "default",
  isPending = false,
  confirmDisabled = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  isPending?: boolean;
  /**
   * Chan nut xac nhan MA KHONG noi doi la dang chay.
   *
   * Dung `isPending` cho mot o nhap con trong se hien "Dang xu ly…" trong khi
   * khong co gi chay ca — man hinh noi nguoc voi su that. Va no con khoa luon
   * nut Huy, nen loi ra duy nhat con lai la phim Esc.
   *
   * `confirmDisabled` chi chan nut xac nhan; nut Huy van mo.
   */
  confirmDisabled?: boolean;
  onConfirm: () => void;
}): React.ReactElement {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription asChild>
              <div className="text-sm text-ink-muted">{description}</div>
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className={cn(buttonVariants({ variant: "outline" }))}
            disabled={isPending}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              buttonVariants({
                variant: tone === "destructive" ? "destructive" : "default",
              }),
            )}
            disabled={isPending || confirmDisabled}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? "Đang xử lý…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
