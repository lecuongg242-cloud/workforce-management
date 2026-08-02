"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Check,
  Clock,
  Loader2,
  MapPinOff,
  WifiOff,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  CameraInUseError,
  CameraPermissionDeniedError,
  LocationPermissionDeniedError,
  LocationTimeoutError,
  NoCameraDeviceError,
  acquireLocation,
  captureFrame,
  closeCamera,
  compressPhoto,
  openCamera,
} from "@/lib/attendance/camera";
import {
  ATTENDANCE_EVIDENCE_LABEL,
  ATTENDANCE_REJECTION_LABEL,
  REQUEST_TYPE_LABEL,
} from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttendanceRejectionReason, PunchEvidence } from "@/lib/types/domain";

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
 * Plan 03-03 (Task 2) them day du bon nhanh loi camera/vi tri con lai (03-01
 * tracer moi chi xu ly `NotAllowedError`): khong co camera dung duoc
 * (`NoCameraDeviceError` — dan sang duong bo sung cong, KHONG mo bo chon
 * anh), camera dang bi ung dung khac giu (`CameraInUseError`), tu choi
 * quyen vi tri (`LocationPermissionDeniedError` — cong client-side, KHONG
 * phai ly do tu choi thu tu cua D-20b vi chua co toa do nao roi khoi thiet
 * bi), va het gio cho GPS (`LocationTimeoutError` — chi doi chip trang thai,
 * KHONG thay ca khung hinh vi khung hinh van dung duoc). Cong them
 * `compressPhoto()` chen giua buoc chup va buoc gui.
 *
 * Plan 03-03 (Task 3) them tang trinh bay KET QUA sau khi Server Action tra
 * ve: ba ly do tu choi cua D-20b (`missing_photo`/`outside_shift` do SERVER
 * quyet, `network_error` la phan loai DUY NHAT client tu quyet khi loi
 * KHONG mang truong `reason` hop le — xem `classifyRejection`), va banner
 * "da ghi nhan nhung o xa" (D-20) doi hoi mot nut cham "Da hieu" thay vi
 * toast thoang qua. `onSubmit` doi tu `Promise<void>` sang
 * `Promise<PunchSubmitResult>` — day la mot thay doi RULE 2 (chuc nang thieu
 * quan trong) ngoai <files> goc cua Task 3: khong co kenh nao khac de
 * `checkIn()` (Server Action) tra khoang cach/ten diem lam viec THAT ve cho
 * banner, nen `src/lib/data/mutations/attendance.ts` va
 * `src/app/employee/employee-home-view.tsx` cung duoc mo rong toi thieu
 * trong commit nay — xem SUMMARY.md muc "Deviations".
 */

type CameraState =
  | "idle"
  | "requesting"
  | "streaming"
  | "captured"
  | "submitting"
  | "permission-denied"
  | "no-camera"
  | "camera-in-use";

type GpsStatus = "acquiring" | "acquired" | "timeout";

interface Coords {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

/** Cac trang thai chan-toan-bo-khung-hinh (khac chip GPS-timeout, KHONG thay
 * khung hinh — xem comment o gpsStatus === "timeout" ben duoi). */
type BlockingOverlay =
  | "loading"
  | "camera-permission-denied"
  | "camera-no-device"
  | "camera-in-use"
  | "location-permission-denied"
  | "rejection"
  | "flagged";

/** Ket qua `onSubmit` phai tra ve (Task 3) — cho phep Camera Sheet tu quyet
 * co hien banner "da ghi nhan nhung o xa" hay khong bang du lieu THAT tu
 * server, khong phai gia dinh o client. */
export interface PunchSubmitResult {
  distanceMeters: number | null;
  workSiteName: string | null;
  isOutsideRadius: boolean;
}

function isRejectionReason(value: unknown): value is AttendanceRejectionReason {
  return (
    value === "missing_photo" ||
    value === "outside_shift" ||
    value === "network_error"
  );
}

/**
 * Phan loai loi tu `onSubmit` (Server Action `checkIn` qua ranh gioi
 * RSC/Server Action). Kiem theo HINH DANG (co truong `reason` hop le),
 * KHONG dung `instanceof` — mot loi nem tu Server Action co the mat nguyen
 * mau khi toi client (tai lieu Next.js: chi `message` chac chan duoc chuyen
 * tiep qua ranh gioi nay, cac truong tuy bien khac co the khong con). Cung
 * huong tiep can voi `isAttendanceRejection()` ma plan 03-04 se dinh nghia
 * chinh thuc trong `src/lib/attendance/rejection.ts` (03-04 phu thuoc 03-03,
 * chua chay o thoi diem plan nay thuc thi). Khong co truong `reason` hop le
 * -> phan loai la `network_error`, phan loai DUY NHAT client tu quyet dinh
 * (D-20b: hai ly do con lai do SERVER quyet).
 */
function classifyRejection(cause: unknown): AttendanceRejectionReason {
  if (
    cause &&
    typeof cause === "object" &&
    "reason" in cause &&
    isRejectionReason((cause as { reason: unknown }).reason)
  ) {
    return (cause as { reason: AttendanceRejectionReason }).reason;
  }
  return "network_error";
}

const REJECTION_ICON: Record<AttendanceRejectionReason, LucideIcon> = {
  missing_photo: CameraOff,
  outside_shift: Clock,
  network_error: WifiOff,
};

function FullScreenMessage({
  icon: Icon,
  iconClassName,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
      <Icon aria-hidden="true" className={cn("size-8", iconClassName)} />
      <p className="heading-sm text-white">{title}</p>
      <p className="text-[13px] text-white/80">{body}</p>
      {children}
    </div>
  );
}

export function CameraSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (evidence: PunchEvidence) => Promise<PunchSubmitResult>;
}): React.ReactElement {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [state, setState] = React.useState<CameraState>("idle");
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [gpsStatus, setGpsStatus] = React.useState<GpsStatus>("acquiring");
  const [locationDenied, setLocationDenied] = React.useState(false);
  const [coords, setCoords] = React.useState<Coords | null>(null);
  const [photoBlob, setPhotoBlob] = React.useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [rejection, setRejection] = React.useState<AttendanceRejectionReason | null>(
    null,
  );
  const [flaggedResult, setFlaggedResult] = React.useState<PunchSubmitResult | null>(
    null,
  );

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
        if (cause instanceof NoCameraDeviceError) {
          setState("no-camera");
          return;
        }
        if (cause instanceof CameraInUseError) {
          setState("camera-in-use");
          return;
        }
        // Loi la thuc su (khong khop bon lop da biet) chua co khoi UI rieng
        // — bao loi va dong Sheet thay vi de man hinh dung im khong phan hoi.
        console.error("Camera open error:", cause);
        toast.error(ATTENDANCE_EVIDENCE_LABEL.cameraOpenErrorToast);
        onOpenChange(false);
      });
  }, [onOpenChange]);

  const startLocation = React.useCallback((): (() => void) => {
    setGpsStatus("acquiring");
    setLocationDenied(false);
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
        if (cause instanceof LocationPermissionDeniedError) {
          setLocationDenied(true);
          return;
        }
        if (cause instanceof LocationTimeoutError) {
          setGpsStatus("timeout");
          return;
        }
        // Loi geolocation la khac (vi du POSITION_UNAVAILABLE) — cung dua
        // ve nut thu lai thay vi treo vo han hoac lam vo giao dien.
        setGpsStatus("timeout");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mo camera + lay vi tri SONG SONG (khong noi tiep) ngay khi Sheet mo.
  React.useEffect(() => {
    if (!open) return;

    setPhotoBlob(null);
    setPreviewUrl(null);
    setCoords(null);
    setRejection(null);
    setFlaggedResult(null);
    startCamera();
    const cancelLocation = startLocation();

    return () => {
      cancelLocation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startCamera/startLocation on chua object reference qua onOpenChange, chi can chay lai khi `open` doi
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
    setRejection(null);
    setFlaggedResult(null);
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
      console.error("Capture frame error:", cause);
      toast.error(ATTENDANCE_EVIDENCE_LABEL.captureErrorToast);
    }
  }

  function handleRetake(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhotoBlob(null);
    setPreviewUrl(null);
    setRejection(null);
    setState("streaming");
  }

  async function handleSubmit(): Promise<void> {
    if (!photoBlob || !coords) return;
    setState("submitting");
    setRejection(null);
    try {
      // Nen anh phia client TRUOC khi roi thiet bi (bien phap thu nhat
      // chong loi vuot gioi han than Server Action — xem camera.ts).
      const compressedPhoto = await compressPhoto(photoBlob);
      const result = await onSubmit({
        photo: compressedPhoto,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracyMeters,
      });
      // Da gui xong — camera khong con can chay nua bat ke ket qua thanh
      // cong binh thuong hay bi danh dau, nhung chi DONG han Sheet o duong
      // thanh cong binh thuong (D-20: ket qua bi danh dau can mot lan cham
      // "Da hieu", khong phai bien mat ngay).
      if (streamRef.current) {
        closeCamera(streamRef.current);
        setStream(null);
      }
      if (result.isOutsideRadius) {
        setFlaggedResult(result);
        setState("captured");
        return;
      }
      handleClose();
    } catch (cause) {
      // Giu lai anh + toa do da co trong bo nho de khong bat nguoi dung chup
      // lai (D-23) — quay ve "captured" thay vi ve "streaming"/"idle".
      setState("captured");
      setRejection(classifyRejection(cause));
    }
  }

  /** Banner "da ghi nhan nhung o xa" chi dong khi nguoi dung CHAM "Da hieu"
   * (D-20: thong tin can nho, khong phai toast thoang qua). */
  function handleAcknowledgeFlagged(): void {
    setFlaggedResult(null);
    handleClose();
  }

  // Uu tien cao nhat: ket qua cua lan gui vua roi (flagged/rejection) luon
  // thang moi trang thai khac, vi day la thong tin nguoi dung PHAI thay
  // truoc khi lam bat cu viec gi tiep theo.
  let overlay: BlockingOverlay | null = null;
  if (flaggedResult) overlay = "flagged";
  else if (rejection) overlay = "rejection";
  else if (state === "permission-denied") overlay = "camera-permission-denied";
  else if (state === "no-camera") overlay = "camera-no-device";
  else if (state === "camera-in-use") overlay = "camera-in-use";
  else if (locationDenied) overlay = "location-permission-denied";
  else if (state === "requesting") overlay = "loading";

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
              aria-label={ATTENDANCE_EVIDENCE_LABEL.closeButtonLabel}
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          {/* --------------------------------------------- Dang mo camera */}
          {overlay === "loading" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white">
              <Loader2 aria-hidden="true" className="size-8 animate-spin" />
              <p className="text-[15px]">{ATTENDANCE_EVIDENCE_LABEL.cameraOpening}</p>
            </div>
          ) : null}

          {/* --------------------------------------------- Tu choi quyen camera */}
          {overlay === "camera-permission-denied" ? (
            <FullScreenMessage
              icon={CameraOff}
              title={ATTENDANCE_EVIDENCE_LABEL.cameraPermissionDeniedTitle}
              body={ATTENDANCE_EVIDENCE_LABEL.cameraPermissionDeniedBody}
            >
              <Button
                type="button"
                variant="onDark"
                size="mobile"
                className="mt-2 max-w-64"
                onClick={startCamera}
              >
                {ATTENDANCE_EVIDENCE_LABEL.retry}
              </Button>
            </FullScreenMessage>
          ) : null}

          {/* --------------------------------------------- Khong co camera dung duoc */}
          {overlay === "camera-no-device" ? (
            <FullScreenMessage
              icon={CameraOff}
              title={ATTENDANCE_EVIDENCE_LABEL.noCameraDeviceTitle}
              body={ATTENDANCE_EVIDENCE_LABEL.noCameraDeviceBody}
            >
              {/* Loi thoat DA CHOT: duong bo sung cong co nguoi duyet, cung
                  lua chon voi mat mang (D-23). KHONG them nut chon anh tu
                  thu vien — lam vay la go bo chinh ATT-01 (T-03-06). */}
              <Button asChild variant="onDark" size="mobile" className="mt-2 max-w-64">
                <Link href="/employee/requests?type=attendance_supplement">
                  {REQUEST_TYPE_LABEL.attendance_supplement}
                </Link>
              </Button>
            </FullScreenMessage>
          ) : null}

          {/* --------------------------------------------- Camera dang duoc dung o noi khac */}
          {overlay === "camera-in-use" ? (
            <FullScreenMessage
              icon={CameraOff}
              title={ATTENDANCE_EVIDENCE_LABEL.cameraInUseTitle}
              body={ATTENDANCE_EVIDENCE_LABEL.cameraInUseBody}
            >
              <Button
                type="button"
                variant="onDark"
                size="mobile"
                className="mt-2 max-w-64"
                onClick={startCamera}
              >
                {ATTENDANCE_EVIDENCE_LABEL.retry}
              </Button>
            </FullScreenMessage>
          ) : null}

          {/* --------------------------------------------- Tu choi quyen vi tri */}
          {overlay === "location-permission-denied" ? (
            <FullScreenMessage
              icon={MapPinOff}
              title={ATTENDANCE_EVIDENCE_LABEL.locationPermissionDeniedTitle}
              body={ATTENDANCE_EVIDENCE_LABEL.locationPermissionDeniedBody}
            >
              {/* Cong CLIENT-SIDE truoc khi gui — KHONG phai ly do tu choi
                  thu tu cua D-20b: chua co toa do nao roi khoi thiet bi o
                  trang thai nay nen chua co yeu cau nao den server ca. */}
              <Button
                type="button"
                variant="onDark"
                size="mobile"
                className="mt-2 max-w-64"
                onClick={startLocation}
              >
                {ATTENDANCE_EVIDENCE_LABEL.retry}
              </Button>
            </FullScreenMessage>
          ) : null}

          {/* --------------------------------------------- Ba ly do tu choi (D-20b) */}
          {overlay === "rejection" && rejection ? (
            <FullScreenMessage
              icon={REJECTION_ICON[rejection]}
              iconClassName="text-red-400"
              title={ATTENDANCE_REJECTION_LABEL[rejection].title}
              body={ATTENDANCE_REJECTION_LABEL[rejection].body}
            >
              {/* Ba ly do — ba hanh dong tiep theo khac nhau, KHONG dung
                  chung mot nut "thu lai": missing_photo can chup lai (anh
                  hien co co the da hong), outside_shift can duong bo sung
                  cong co nguoi duyet (khong phai gui lai chinh lan bi tu
                  choi), network_error can gui lai DUNG anh/toa do dang giu
                  (D-23: khong bat chup lai). */}
              {rejection === "missing_photo" ? (
                <Button
                  type="button"
                  variant="onDark"
                  size="mobile"
                  className="mt-2 max-w-64"
                  onClick={handleRetake}
                >
                  {ATTENDANCE_EVIDENCE_LABEL.retake}
                </Button>
              ) : null}
              {rejection === "outside_shift" ? (
                <Button asChild variant="onDark" size="mobile" className="mt-2 max-w-64">
                  <Link href="/employee/requests?type=attendance_supplement">
                    {REQUEST_TYPE_LABEL.attendance_supplement}
                  </Link>
                </Button>
              ) : null}
              {rejection === "network_error" ? (
                <Button
                  type="button"
                  variant="onDark"
                  size="mobile"
                  className="mt-2 max-w-64"
                  onClick={handleSubmit}
                >
                  {ATTENDANCE_EVIDENCE_LABEL.submitRetry}
                </Button>
              ) : null}
            </FullScreenMessage>
          ) : null}

          {/* --------------------------------------------- Da ghi nhan nhung o xa (D-20) */}
          {overlay === "flagged" && flaggedResult ? (
            <FullScreenMessage
              icon={AlertTriangle}
              iconClassName="text-amber-400"
              title={ATTENDANCE_EVIDENCE_LABEL.outsideRadiusTitle}
              body={[
                ATTENDANCE_EVIDENCE_LABEL.outsideRadiusBodyPrefix,
                flaggedResult.workSiteName,
                ATTENDANCE_EVIDENCE_LABEL.outsideRadiusDistanceLabel,
                `${formatNumber(Math.round(flaggedResult.distanceMeters ?? 0))} m.`,
                ATTENDANCE_EVIDENCE_LABEL.outsideRadiusBodySuffix,
              ].join(" ")}
            >
              {/* Khong phai loi — mot lan cham xac nhan "Da hieu", KHONG
                  phai toast thoang qua, vi day la thong tin nhan vien can
                  nho (ban ghi cua ho se bi xem lai). Khong hien do chinh
                  xac GPS o day — con so do chi co gia tri o man hinh quan
                  tri. */}
              <Button
                type="button"
                variant="onDark"
                size="mobile"
                className="mt-2 max-w-64"
                onClick={handleAcknowledgeFlagged}
              >
                {ATTENDANCE_EVIDENCE_LABEL.acknowledge}
              </Button>
            </FullScreenMessage>
          ) : null}

          {/* --------------------------------------------- Dang phat / da chup */}
          {overlay === null &&
          (state === "streaming" || state === "captured" || state === "submitting") ? (
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
                  alt={ATTENDANCE_EVIDENCE_LABEL.capturedPhotoAlt}
                  className="h-full w-full object-cover"
                />
              ) : null}

              {/* Lop phu mo toi tren viewfinder — ngoai le 60/30/10 da ghi o UI-SPEC */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-8">
                {/* Chip trang thai vi tri — GPS timeout (LocationTimeoutError)
                    KHONG thay ca khung hinh (khung hinh van dung duoc, chi
                    thieu toa do): chi mot minh chip nay doi thanh nut thu lai. */}
                <div className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[13px] text-white">
                  {gpsStatus === "acquired" ? (
                    <>
                      <Check aria-hidden="true" className="size-3.5" />
                      {ATTENDANCE_EVIDENCE_LABEL.gpsAcquired}
                    </>
                  ) : gpsStatus === "timeout" ? (
                    <button
                      type="button"
                      onClick={startLocation}
                      className="flex items-center gap-1.5"
                    >
                      <MapPinOff aria-hidden="true" className="size-3.5" />
                      {ATTENDANCE_EVIDENCE_LABEL.retry}
                    </button>
                  ) : (
                    <>
                      <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                      {ATTENDANCE_EVIDENCE_LABEL.gpsAcquiring}
                    </>
                  )}
                </div>

                {state === "streaming" ? (
                  <button
                    type="button"
                    onClick={handleCapture}
                    aria-label={ATTENDANCE_EVIDENCE_LABEL.captureButtonLabel}
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
