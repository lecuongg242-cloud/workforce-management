/**
 * Module thuan (khong phu thuoc React) cho luong camera truc tiep + GPS cua
 * man hinh cham cong (ATT-01). Test duoc bang Vitest voi `navigator` gia
 * lap (khong can DOM that).
 *
 * Bon lop loi cua `getUserMedia()` va hai lop loi cua geolocation duoc dinh
 * nghia o day, dung ten `DOMException`/ma `GeolocationPositionError` chuan
 * cua trinh duyet (RESEARCH.md §"Pattern 1"/§"Pattern 3"). Plan 03-01 (tracer)
 * chi phan loai nhanh `NotAllowedError`; plan nay (03-03) dien not ba nhanh
 * con lai cua getUserMedia, ca hai nhanh cua geolocation, va them
 * `compressPhoto()`.
 */

import imageCompression from "browser-image-compression";

export class CameraPermissionDeniedError extends Error {
  constructor() {
    super("Không có quyền dùng camera.");
    this.name = "CameraPermissionDeniedError";
  }
}

/** `NotFoundError`/`OverconstrainedError` — khong co camera nao dung duoc, chung MOT loi thoat (03-RESEARCH §"Pattern 1"). */
export class NoCameraDeviceError extends Error {
  constructor() {
    super("Không tìm thấy camera trên thiết bị này.");
    this.name = "NoCameraDeviceError";
  }
}

/** `NotReadableError` — camera dang duoc mot ung dung khac su dung (backstop, UI-SPEC hang "Camera-in-use"). */
export class CameraInUseError extends Error {
  constructor() {
    super("Camera đang được dùng ở nơi khác.");
    this.name = "CameraInUseError";
  }
}

/** `GeolocationPositionError.PERMISSION_DENIED` — cong client-side truoc khi gui, khong phai ly do tu choi thu tu cua D-20b. */
export class LocationPermissionDeniedError extends Error {
  constructor() {
    super("Không có quyền truy cập vị trí.");
    this.name = "LocationPermissionDeniedError";
  }
}

/** `GeolocationPositionError.TIMEOUT` — het GPS_TIMEOUT_MS ma chua co toa do, KHONG treo vo han. */
export class LocationTimeoutError extends Error {
  constructor() {
    super("Hết thời gian chờ xác định vị trí.");
    this.name = "LocationTimeoutError";
  }
}

/**
 * Cold GPS fix trong nha xuong mat 10-20 giay, nen moc 5 giay thuong thay o
 * vi du tai lieu tao ra that bai gia dung tren chinh kich ban ma D-20 lo
 * ngai. Con so nay la diem khoi dau va con can do tai van phong that (muc QA
 * thu cong o plan 03-07) — CHUA duoc do that, ghi thang vao day de nguoi doc
 * sau biet day la gia dinh, khong phai so da kiem chung.
 */
export const GPS_TIMEOUT_MS = 15_000;

/**
 * Muc tieu nen anh phia client (browser-image-compression). Day la BIEN PHAP
 * THU NHAT chong loi "Body exceeded 1 MB limit" cua Server Action; bien an
 * toan thu hai la `experimental.serverActions.bodySizeLimit: "4mb"` trong
 * `next.config.ts` (them tu plan 03-01, RESEARCH.md §"Pitfall 5") — KHONG
 * duoc dua vao chi mot trong hai.
 */
export const PHOTO_MAX_SIZE_MB = 1;
export const PHOTO_MAX_DIMENSION = 1600;

/**
 * Yeu cau camera SAU qua `facingMode` voi gia tri `ideal` (khong phai gia
 * tri buoc-phai-dung): tren thiet bi chi co MOT camera, mot rang buoc
 * buoc-phai-dung se nem loi du camera do van dung duoc — `ideal` la mot goi
 * y, khong phai mot dieu kien chan. `audio` tat vi khong can ghi am cho
 * bang chung cham cong.
 *
 * Luu y QA thu cong: `NotAllowedError` cung la loi nem ra khi trang chay
 * ngoai ngu canh an toan (HTTP thay vi HTTPS/localhost). Khi thu tren dien
 * thoai that qua mot dia chi LAN (vi du 192.168.x.x, khong phai localhost),
 * camera se hong voi DUNG loi nay du chua ai duoc hoi quyen — de nham la loi
 * quyen trong khi la loi giao thuc (RESEARCH.md §"Pattern 1").
 */
export async function openCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
  } catch (cause) {
    if (cause instanceof DOMException) {
      switch (cause.name) {
        case "NotAllowedError":
          throw new CameraPermissionDeniedError();
        case "NotFoundError":
        case "OverconstrainedError":
          throw new NoCameraDeviceError();
        case "NotReadableError":
          throw new CameraInUseError();
      }
    }
    // Loi la (khong khop bon ten DOMException da biet) duoc nem TIEP nguyen
    // ban thay vi gop vao mot lop loi da co — gop se khien man hinh hien
    // thi mot loi giai thich SAI ve mot nguyen nhan chua biet (T-03-03-04).
    throw cause;
  }
}

/**
 * Dung TUNG track — chi bo tham chieu stream thi den camera VAN sang (day
 * khong phai mot chi tiet vun vat: nguoi dung nhin thay den camera van sang
 * sau khi da dong man hinh se mat long tin vao ung dung).
 */
export function closeCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Dung mot the `<video>` dang phat luong truc tiep, ve ra canvas dung kich
 * thuoc that (`videoWidth`/`videoHeight`) roi xuat JPEG chat luong 0.9. Anh
 * dung tu canvas KHONG MANG EXIF ngay tu dau — day la HE QUA CAU TRUC cua
 * chinh kien truc ma ATT-01 doi hoi (luong media truc tiep, khong phai tep
 * anh co san), khong phai mot buoc tach EXIF can them.
 */
export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Không thể chụp khung hình."));
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Không thể chụp khung hình."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.9,
    );
  });
}

/**
 * Nen anh phia client bang `browser-image-compression` (chay tren luong nen
 * — worker thread — de khong dung hinh giao dien khi nen anh lon). Boc trong
 * try/catch: nen hong thi TRA LAI ANH GOC va chi ghi mot dong console.warn,
 * vi mot lan cham cong khong duoc phep that bai chi vi mot buoc toi uu bang
 * thong.
 */
export async function compressPhoto(blob: Blob): Promise<Blob> {
  try {
    const compressed = await imageCompression(blob as File, {
      maxSizeMB: PHOTO_MAX_SIZE_MB,
      maxWidthOrHeight: PHOTO_MAX_DIMENSION,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
    return compressed.size <= blob.size ? compressed : blob;
  } catch (cause) {
    console.warn("Nén ảnh thất bại, dùng ảnh gốc:", cause);
    return blob;
  }
}

/**
 * Boc `getCurrentPosition` thanh Promise. `enableHighAccuracy` bat,
 * `maximumAge` bang 0 — MOI lan cham cong la MOT phep do moi, khong bao gio
 * dung vi tri cache cua lan truoc (mot nhan vien di chuyen giua hai lan cham
 * cong khong duoc phep "thua ke" toa do cu). `timeout` dung DUNG
 * `GPS_TIMEOUT_MS` — het gio khong treo vo han, chip trang thai vi tri se
 * doi thanh nut thu lai (camera-sheet.tsx).
 */
export function acquireLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (cause) => {
        if (cause.code === cause.PERMISSION_DENIED) {
          reject(new LocationPermissionDeniedError());
          return;
        }
        if (cause.code === cause.TIMEOUT) {
          reject(new LocationTimeoutError());
          return;
        }
        reject(cause);
      },
      {
        enableHighAccuracy: true,
        timeout: GPS_TIMEOUT_MS,
        maximumAge: 0,
      },
    );
  });
}
