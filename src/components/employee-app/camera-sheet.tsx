"use client";

import * as React from "react";
import { toast } from "sonner";
import { Camera, CameraOff, Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  CameraPermissionDeniedError,
  acquireLocation,
  captureFrame,
  closeCamera,
  openCamera,
} from "@/lib/attendance/camera";
import { ATTENDANCE_EVIDENCE_LABEL } from "@/lib/constants";
import type { PunchEvidence } from "@/lib/types/domain";

/**
 * Sheet toan man hinh: viewfinder -> chup -> xem lai -> gui. Thay HAN thanh
 * dieu huong duoi khi mo (khong phu len no) — day la mot tac vu modal, khong
 * phai mot diem den dieu huong (UI-SPEC §"Spacing Scale").
 *
 * KHONG dung phan tu chon tep cua HTML (the input voi kieu "file") o BAT KY
 * DAU nao trong file nay hay trong cay `src/app/employee/`. Thuoc tinh goi y
 * chup anh cua phan tu do ("capture") cung KHONG DU: tren iOS Safari he dieu
 * hanh van luon hien bo chon thu vien anh ben canh camera, nen duong duy
 * nhat loai tru duoc thu vien anh la luong media truc tiep qua canvas
 * (`captureFrame`, `src/lib/attendance/camera.ts`) — khong co con duong nao
 * khac trong file nay dung duoc anh co san lam bang chung (T-03-06).
 *
 * Khong doc dong ho thiet bi o lan ve dau (rule D-19a) — dau thoi gian den
 * tu server (`tf_server_now()`), khong mot dong nao trong file nay goi ham
 * dung de lay thoi diem hien tai cua trinh duyet.
 *
 * O plan tracer nay (03-01) hien thuc du duong hanh phuc cong nhanh tu choi
 * quyen camera (`NotAllowedError`). Ba nhanh loi camera con lai va nhanh tu
 * choi quyen vi tri deu duoc `src/lib/attendance/camera.ts` nem tiep nguyen
 * ban — o day chi xu ly toi thieu (toast + dong Sheet) de khong lam vo giao
 * dien; UI rieng cho tung nhanh do thuoc plan 03-03.
 */

type CameraState =
  | "idle"
  | "requesting"
  | "streaming"
  | "captured"
  | "submitting"
  | "permission-denied";

type GpsStatus = "acquiring" | "acquired" | "error";

interface Coords {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export function CameraSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (evidence: PunchEvidence) => Promise<void>;
}): React.ReactElement {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [state, setState] = React.useState<CameraState>("idle");
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [gpsStatus, setGpsStatus] = React.useState<GpsStatus>("acquiring");
  const [coords, setCoords] = React.useState<Coords | null>(null);
  const [photoBlob, setPhotoBlob] = React.useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const streamRef = React.useRef<MediaStream | null>(null);
  streamRef.current = stream;

  const startCamera = React.useCallback(() => {
    setState("requesting");
    openCamera()
      .then((mediaStream) => {
        setStream(mediaStream);
        setState("streaming");
      })
      .catch((cause) => {
        if (cause instanceof CameraPermissionDeniedError) {
          setState("permission-denied");
          return;
        }
        // Ba nhanh loi con lai (thiet bi khong co camera, camera dang ban,
        // rang buoc khong thoa man) chua co khoi UI rieng o plan nay (03-03
        // se them) — xu ly toi thieu: bao loi va dong Sheet thay vi de man
        // hinh dung im khong phan hoi.
        console.error("Lỗi mở camera:", cause);
        toast.error("Không mở được camera. Vui lòng thử lại.");
        onOpenChange(false);
      });
  }, [onOpenChange]);

  // Mo camera + lay vi tri SONG SONG (khong noi tiep) ngay khi Sheet mo.
  React.useEffect(() => {
    if (!open) return;

    setPhotoBlob(null);
    setPreviewUrl(null);
    setCoords(null);
    setGpsStatus("acquiring");
    startCamera();

    let cancelled = false;
    acquireLocation()
      .then((position) => {
        if (cancelled) return;
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
        setGpsStatus("acquired");
      })
      .catch((cause) => {
        if (cancelled) return;
        // Tu choi quyen vi tri chua co khoi UI rieng o plan nay (03-03 se
        // them) — chip trang thai o duoi day se dung o "acquiring" mai mai,
        // giu nut gui vo hieu thay vi gui toa do gia.
        console.error("Lỗi lấy vị trí:", cause);
        setGpsStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startCamera on chua object reference qua onOpenChange, chi can chay lai khi `open` doi
  }, [open]);

  // Gan stream vao the <video> khi co
  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play();
    }
  }, [stream]);

  // Don dep: dung camera khi component go khoi cay (dong bo an toan cho ca
  // truong hop dong Sheet lan mat/refresh).
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        closeCamera(streamRef.current);
      }
    };
  }, []);

  // Thu hoi Object URL cua anh xem lai khi doi/go component, tranh ro bo nho.
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleClose(): void {
    // Dong Sheet o BAT KY trang thai nao deu goi closeCamera().
    if (streamRef.current) {
      closeCamera(streamRef.current);
    }
    setStream(null);
    setState("idle");
    onOpenChange(false);
  }

  async function handleCapture(): Promise<void> {
    if (!videoRef.current) return;
    try {
      const blob = await captureFrame(videoRef.current);
      setPhotoBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setState("captured");
    } catch (cause) {
      console.error("Lỗi chụp khung hình:", cause);
      toast.error("Không thể chụp ảnh. Vui lòng thử lại.");
    }
  }

  function handleRetake(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhotoBlob(null);
    setPreviewUrl(null);
    setState("streaming");
  }

  async function handleSubmit(): Promise<void> {
    if (!photoBlob || !coords) return;
    setState("submitting");
    try {
      await onSubmit({
        photo: photoBlob,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracyMeters,
      });
      handleClose();
    } catch (cause) {
      // Giu lai anh + toa do da co trong bo nho de khong bat nguoi dung chup
      // lai (D-23) — quay ve "captured" thay vi ve "streaming"/"idle".
      setState("captured");
      toast.error(
        cause instanceof Error ? cause.message : "Không gửi được chấm công.",
      );
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="inset-0 h-full w-full max-w-none border-0 bg-black p-0 sm:max-w-none"
      >
        <SheetTitle className="sr-only">Chấm công bằng camera</SheetTitle>

        <div className="relative flex h-full w-full flex-col">
          {/* Nut dong — nho, goc tren, khong canh tranh voi nut chup */}
          <div className="absolute top-4 right-4 z-10">
            <Button
              type="button"
              variant="onDark"
              size="icon-mobile"
              onClick={handleClose}
              aria-label="Đóng"
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          {/* --------------------------------------------- Dang mo camera */}
          {state === "requesting" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white">
              <Loader2 aria-hidden="true" className="size-8 animate-spin" />
              <p className="text-[15px]">{ATTENDANCE_EVIDENCE_LABEL.cameraOpening}</p>
            </div>
          ) : null}

          {/* --------------------------------------------- Tu choi quyen camera */}
          {state === "permission-denied" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
              <CameraOff aria-hidden="true" className="size-8" />
              <p className="heading-sm text-white">
                {ATTENDANCE_EVIDENCE_LABEL.cameraPermissionDeniedTitle}
              </p>
              <p className="text-[13px] text-white/80">
                {ATTENDANCE_EVIDENCE_LABEL.cameraPermissionDeniedBody}
              </p>
              <Button
                type="button"
                variant="onDark"
                size="mobile"
                className="mt-2 max-w-64"
                onClick={startCamera}
              >
                {ATTENDANCE_EVIDENCE_LABEL.retry}
              </Button>
            </div>
          ) : null}

          {/* --------------------------------------------- Dang phat / da chup */}
          {state === "streaming" || state === "captured" || state === "submitting" ? (
            <div className="relative flex-1 overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={
                  state === "streaming"
                    ? "h-full w-full object-cover"
                    : "hidden"
                }
              />
              {previewUrl && state !== "streaming" ? (
                // eslint-disable-next-line @next/next/no-img-element -- Object URL cuc bo, khong hop voi optimizer cua next/image
                <img
                  src={previewUrl}
                  alt="Ảnh vừa chụp"
                  className="h-full w-full object-cover"
                />
              ) : null}

              {/* Lop phu mo toi tren viewfinder — ngoai le 60/30/10 da ghi o UI-SPEC */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-8">
                {/* Chip trang thai vi tri */}
                <div className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[13px] text-white">
                  {gpsStatus === "acquired" ? (
                    <Check aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                  )}
                  {gpsStatus === "acquired"
                    ? ATTENDANCE_EVIDENCE_LABEL.gpsAcquired
                    : ATTENDANCE_EVIDENCE_LABEL.gpsAcquiring}
                </div>

                {state === "streaming" ? (
                  <button
                    type="button"
                    onClick={handleCapture}
                    aria-label="Chụp ảnh"
                    className="size-[72px] shrink-0 rounded-full border-4 border-white bg-white/20 transition-colors hover:bg-white/30 active:bg-white/40"
                  >
                    <Camera aria-hidden="true" className="mx-auto size-6 text-white" />
                  </button>
                ) : (
                  <div className="grid w-full grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="mobile"
                      disabled={state === "submitting"}
                      onClick={handleRetake}
                    >
                      {ATTENDANCE_EVIDENCE_LABEL.retake}
                    </Button>
                    <Button
                      type="button"
                      size="mobile"
                      disabled={state === "submitting" || !photoBlob || !coords}
                      onClick={handleSubmit}
                    >
                      {state === "submitting" ? (
                        <>
                          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                          {ATTENDANCE_EVIDENCE_LABEL.submitPending}
                        </>
                      ) : (
                        ATTENDANCE_EVIDENCE_LABEL.submitIdle
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
