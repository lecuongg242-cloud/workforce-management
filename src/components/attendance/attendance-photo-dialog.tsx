"use client";

import * as React from "react";
import { CheckCircle2, Clock, ImageOff, MapPin, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { listAttendancePhotos, markPhotoReviewed } from "@/lib/data/attendance-photos";
import { useDataStore } from "@/lib/data/store";
import {
  ATTENDANCE_PHOTO_DIALOG_LABEL,
  ATTENDANCE_REVIEW_LABEL,
  DEFAULT_TIMEZONE,
  PHOTO_REVIEW_STATUS_LABEL,
  PHOTO_REVIEW_STATUS_TONE,
} from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { AttendancePhoto, PhotoReviewStatus } from "@/lib/types/domain";

/**
 * Dialog xem lai day du cua quan tri cho bang chung cham cong (ATT-04).
 * Ban toi gian cua plan 03-01 chi hien mot anh; plan nay cam them phan con
 * lai vao CUNG mot hinh dang component: toa do, khoang cach LUON di kem do
 * chinh xac GPS, ten diem lam viec, lien ket ban do ngoai (nguoi dung chu
 * dong bam, khong nhung khung, khong goi dich vu ban do nao tu server —
 * T-03-05-03), va hanh dong "Đánh dấu đã xem xét".
 *
 * The anh luon tro vao broker route `/api/attendance-photos/{id}` (03-01);
 * sieu du lieu (khong phai byte anh) doc qua `listAttendancePhotos()`
 * (`GET /api/attendance-photos`, 03-05 Task 1) — hai duong khac nhau tuyet
 * doi, khong duong nao tra mot chuoi dan chieu toi mien luu tru.
 */

const kindOrder: readonly AttendancePhoto["kind"][] = ["check_in", "check_out"];

const reviewStatusIcon: Record<PhotoReviewStatus, LucideIcon> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

const capturedAtFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: DEFAULT_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatCapturedAt(isoDateTime: string): string {
  return capturedAtFormatter.format(new Date(isoDateTime));
}

export function AttendancePhotoDialog({
  attendanceRecordId,
  onOpenChange,
}: {
  /** `null` nghia la Dialog dang dong */
  attendanceRecordId: string | null;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const { invalidate } = useDataStore();
  const [isReviewing, setIsReviewing] = React.useState(false);

  const open = attendanceRecordId !== null;

  const { data: photos, isLoading, error, reload } = useDataQuery(
    () => (attendanceRecordId ? listAttendancePhotos(attendanceRecordId) : Promise.resolve([])),
    [attendanceRecordId],
  );

  const photoByKind = React.useMemo(() => {
    const map = new Map<AttendancePhoto["kind"], AttendancePhoto>();
    for (const photo of photos ?? []) {
      map.set(photo.kind, photo);
    }
    return map;
  }, [photos]);

  const hasAnyPhoto = photoByKind.size > 0;

  async function handleMarkReviewed(): Promise<void> {
    if (!photos || photos.length === 0) return;
    setIsReviewing(true);
    try {
      await Promise.all(
        photos.map((photo) => markPhotoReviewed(photo.id, "approved")),
      );
      invalidate();
      reload();
      toast.success(ATTENDANCE_PHOTO_DIALOG_LABEL.reviewSuccessToast);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : ATTENDANCE_PHOTO_DIALOG_LABEL.reviewErrorToast,
      );
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ảnh chấm công</DialogTitle>
          <DialogDescription>
            Ảnh hiện trường được chụp trực tiếp tại thời điểm chấm công.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="aspect-[4/3] w-full rounded-panel" />
            <div className="grid gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-ink-muted">
            <ImageOff aria-hidden="true" className="size-6" />
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={reload}>
              {ATTENDANCE_PHOTO_DIALOG_LABEL.fetchErrorReload}
            </Button>
          </div>
        ) : null}

        {!isLoading && !error && !hasAnyPhoto ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-ink-muted">
            <ImageOff aria-hidden="true" className="size-6" />
            <p>{ATTENDANCE_PHOTO_DIALOG_LABEL.noPhoto}</p>
          </div>
        ) : null}

        {!isLoading && !error && hasAnyPhoto ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-3">
                {kindOrder.map((kind) => {
                  const photo = photoByKind.get(kind);
                  return photo ? (
                    <PhotoSlot
                      key={kind}
                      photo={photo}
                      label={ATTENDANCE_PHOTO_DIALOG_LABEL.kindLabel[kind]}
                    />
                  ) : (
                    <MissingLegSlot
                      key={kind}
                      label={ATTENDANCE_PHOTO_DIALOG_LABEL.kindLabel[kind]}
                    />
                  );
                })}
              </div>

              <div className="grid gap-4">
                {kindOrder.map((kind) => {
                  const photo = photoByKind.get(kind);
                  return (
                    <PhotoMetadata
                      key={kind}
                      kindLabel={ATTENDANCE_PHOTO_DIALOG_LABEL.kindLabel[kind]}
                      photo={photo ?? null}
                    />
                  );
                })}
              </div>
            </div>

            {/* Ghi chu pham vi bang chung — dong duoi day noi ro: anh nay
                KHONG dung de "đối chiếu khuôn mặt" hay "xác nhận danh tính"
                nguoi cham cong. No chi chung minh mot thiet bi da o dung
                noi, khong chung minh dung nguoi (PROJECT.md §Key
                Decisions). Day khong phai chu trang tri: no ngan nguoi doc
                dung anh lam can cu cho mot ket luan ma anh khong he noi
                toi. */}
            <p className="text-xs text-ink-muted">
              {ATTENDANCE_PHOTO_DIALOG_LABEL.scopeNote}
            </p>

            <DialogFooter>
              <Button onClick={handleMarkReviewed} disabled={isReviewing}>
                {ATTENDANCE_REVIEW_LABEL.reviewAction}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

function PhotoSlot({
  photo,
  label,
}: {
  photo: AttendancePhoto;
  label: string;
}): React.ReactElement {
  const [imgState, setImgState] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);

  function handleReload(): void {
    setImgState("loading");
    setReloadKey((key) => key + 1);
  }

  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-medium text-ink-secondary">{label}</p>
      {/* O anh ti le co dinh — giu bo cuc khong nhay khi dang tai */}
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-panel border border-hairline bg-canvas-soft">
        {imgState === "loading" ? (
          <Skeleton className="absolute inset-0 rounded-panel" />
        ) : null}

        {imgState === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-canvas-soft px-4 text-center text-sm text-ink-muted">
            <ImageOff aria-hidden="true" className="size-6" />
            <p>{ATTENDANCE_PHOTO_DIALOG_LABEL.loadError}</p>
            <Button variant="outline" size="sm" onClick={handleReload}>
              {ATTENDANCE_PHOTO_DIALOG_LABEL.reload}
            </Button>
          </div>
        ) : null}

        {/* Broker route phat byte anh dong (khong phai anh tinh), khong hop
            voi optimizer cua next/image; xem ghi chu dau file. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={reloadKey}
          src={`/api/attendance-photos/${photo.id}`}
          alt={label}
          className={
            imgState === "error" ? "hidden" : "h-full w-full object-cover"
          }
          onLoad={() => setImgState("ready")}
          onError={() => setImgState("error")}
        />
      </div>
    </div>
  );
}

function MissingLegSlot({ label }: { label: string }): React.ReactElement {
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-medium text-ink-secondary">{label}</p>
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-hairline bg-canvas-soft px-4 text-center text-sm text-ink-muted">
        <ImageOff aria-hidden="true" className="size-6" />
        <p>{ATTENDANCE_PHOTO_DIALOG_LABEL.missingLeg}</p>
      </div>
    </div>
  );
}

function PhotoMetadata({
  kindLabel,
  photo,
}: {
  kindLabel: string;
  photo: AttendancePhoto | null;
}): React.ReactElement {
  const ReviewIcon = photo ? reviewStatusIcon[photo.reviewStatus] : Clock;

  return (
    <div className="grid gap-1.5 rounded-panel border border-hairline p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-secondary">{kindLabel}</p>
        {photo ? (
          <StatusBadge
            kind="custom"
            label={PHOTO_REVIEW_STATUS_LABEL[photo.reviewStatus]}
            tone={PHOTO_REVIEW_STATUS_TONE[photo.reviewStatus]}
            icon={ReviewIcon}
            size="sm"
          />
        ) : null}
      </div>

      {!photo ? (
        <p className="text-sm text-ink-muted">
          {ATTENDANCE_PHOTO_DIALOG_LABEL.missingLeg}
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-secondary">
            {ATTENDANCE_PHOTO_DIALOG_LABEL.capturedAtLabel}:{" "}
            <span className="num font-medium text-ink">
              {formatCapturedAt(photo.capturedAt)}
            </span>
          </p>

          <p className="text-sm text-ink-secondary">
            {ATTENDANCE_PHOTO_DIALOG_LABEL.workSiteLabel}:{" "}
            {photo.workSiteId ? (
              <span className="font-medium text-ink">{photo.workSiteName}</span>
            ) : (
              <span className="text-ink-muted">
                {ATTENDANCE_PHOTO_DIALOG_LABEL.noWorkSite}
              </span>
            )}
          </p>

          {/* Khoang cach va do chinh xac LUON dung canh nhau (khong bao gio
              tach roi) — day chinh la ly do D-20 doi tu chan cung sang ghi
              nhan: GPS trong nha xuong sai 20-50m, mot dong "cach 620m"
              dung mot minh khien nguoi doc khong phan biet duoc "GPS do
              sai" voi "dung xa that". */}
          {photo.distanceMeters !== null ? (
            <p className="text-sm text-ink-secondary">
              {ATTENDANCE_PHOTO_DIALOG_LABEL.distanceTowardsSitePrefix}{" "}
              <span className="font-medium text-ink">{photo.workSiteName}</span>{" "}
              {ATTENDANCE_PHOTO_DIALOG_LABEL.distanceTowardsSiteSuffix}{" "}
              <span className="num font-medium text-ink">
                {formatNumber(Math.round(photo.distanceMeters))} m
              </span>
              .
            </p>
          ) : null}

          {photo.accuracyMeters !== null ? (
            <p className="text-xs text-ink-muted">
              {ATTENDANCE_PHOTO_DIALOG_LABEL.accuracyLabel}:{" "}
              <span className="num font-medium text-ink">
                {formatNumber(Math.round(photo.accuracyMeters))} m
              </span>{" "}
              — {ATTENDANCE_PHOTO_DIALOG_LABEL.accuracyExplain}
            </p>
          ) : null}

          <p className="num text-xs text-ink-muted">
            {ATTENDANCE_PHOTO_DIALOG_LABEL.coordinateLabel}: {photo.latitude.toFixed(6)},{" "}
            {photo.longitude.toFixed(6)}
          </p>

          <a
            href={`https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-brand underline underline-offset-2 hover:text-brand-deep"
          >
            <MapPin aria-hidden="true" className="size-3.5" />
            {ATTENDANCE_PHOTO_DIALOG_LABEL.openMapLink}
          </a>
        </>
      )}
    </div>
  );
}
