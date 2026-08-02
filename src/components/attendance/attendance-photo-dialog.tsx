"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getAttendancePhotoForRecord } from "@/lib/data/attendance-photos";
import { ATTENDANCE_PHOTO_DIALOG_LABEL } from "@/lib/constants";

/**
 * Dialog toi gian cua quan tri de xem lai anh cham cong (ATT-04). O plan
 * tracer nay (03-01) Dialog CHI hien thi anh; khoang cach, toa do, do chinh
 * xac, lien ket ban do va hanh dong "Đánh dấu đã xem xét" thuoc plan 03-05
 * va se cam vao chinh component nay ma khong doi hinh dang no.
 *
 * The anh luon tro vao broker route `/api/attendance-photos/{id}` (Task 2)
 * — KHONG BAO GIO vao mot mien ngoai (T-03-01).
 */

type LoadState = "loading" | "no-photo" | "ready" | "load-error" | "fetch-error";

export function AttendancePhotoDialog({
  attendanceRecordId,
  kind = "check_in",
  onOpenChange,
}: {
  /** `null` nghia la Dialog dang dong */
  attendanceRecordId: string | null;
  kind?: "check_in" | "check_out";
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const [state, setState] = React.useState<LoadState>("loading");
  const [photoId, setPhotoId] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const open = attendanceRecordId !== null;

  React.useEffect(() => {
    if (!attendanceRecordId) return;
    let cancelled = false;
    setState("loading");
    setPhotoId(null);

    getAttendancePhotoForRecord(attendanceRecordId, kind)
      .then((photo) => {
        if (cancelled) return;
        if (!photo) {
          setState("no-photo");
          return;
        }
        setPhotoId(photo.id);
        setState("ready");
      })
      .catch((cause) => {
        if (cancelled) return;
        console.error("Không tải được ảnh chấm công:", cause);
        setState("fetch-error");
      });

    return () => {
      cancelled = true;
    };
  }, [attendanceRecordId, kind, reloadKey]);

  function handleImageError(): void {
    setState("load-error");
  }

  function handleReload(): void {
    setReloadKey((key) => key + 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ảnh chấm công</DialogTitle>
          <DialogDescription>
            Ảnh hiện trường được chụp trực tiếp tại thời điểm chấm công.
          </DialogDescription>
        </DialogHeader>

        {/* O anh ti le co dinh — giu bo cuc khong nhay khi dang tai */}
        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-panel border border-hairline bg-canvas-soft">
          {state === "loading" ? (
            <Skeleton className="absolute inset-0 rounded-panel" />
          ) : null}

          {state === "no-photo" ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center text-sm text-ink-muted">
              <ImageOff aria-hidden="true" className="size-6" />
              <p>{ATTENDANCE_PHOTO_DIALOG_LABEL.noPhoto}</p>
            </div>
          ) : null}

          {state === "fetch-error" ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center text-sm text-ink-muted">
              <ImageOff aria-hidden="true" className="size-6" />
              <p>{ATTENDANCE_PHOTO_DIALOG_LABEL.loadError}</p>
              <Button variant="outline" size="sm" onClick={handleReload}>
                {ATTENDANCE_PHOTO_DIALOG_LABEL.reload}
              </Button>
            </div>
          ) : null}

          {state === "load-error" ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center text-sm text-ink-muted">
              <ImageOff aria-hidden="true" className="size-6" />
              <p>{ATTENDANCE_PHOTO_DIALOG_LABEL.loadError}</p>
              <Button variant="outline" size="sm" onClick={handleReload}>
                {ATTENDANCE_PHOTO_DIALOG_LABEL.reload}
              </Button>
            </div>
          ) : null}

          {state === "ready" && photoId ? (
            // Broker route phat byte anh dong (khong phai anh tinh), khong
            // hop voi optimizer cua next/image; xem ghi chu dau file.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={reloadKey}
              src={`/api/attendance-photos/${photoId}`}
              alt="Ảnh chấm công"
              className="h-full w-full object-cover"
              onError={handleImageError}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
