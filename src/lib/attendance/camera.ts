/**
 * Module thuan (khong phu thuoc React) cho luong camera truc tiep + GPS cua
 * man hinh cham cong (ATT-01). Test duoc bang Vitest voi `navigator` gia
 * lap (khong can DOM that).
 *
 * Bon lop loi cua `getUserMedia()` duoc DINH NGHIA SAN o day, dung ten
 * DOMException chuan cua trinh duyet. Plan nay (03-01, tracer) CHI phan loai
 * va xu ly day du nhanh `NotAllowedError` (CameraPermissionDeniedError) —
 * ba nhanh con lai duoc `openCamera()` NEM TIEP nguyen ban loi goc, de plan
 * 03-03 chi can bat dung lop da co san va noi UI rieng, khong phai doi hinh
 * dang cua module nay.
 */

export class CameraPermissionDeniedError extends Error {
  constructor() {
    super("Không có quyền dùng camera.");
    this.name = "CameraPermissionDeniedError";
  }
}

/** `NotFoundError`/`OverconstrainedError` — thiet bi khong co camera dung duoc. */
export class CameraNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy camera trên thiết bị này.");
    this.name = "CameraNotFoundError";
  }
}

/** `NotReadableError` — camera dang duoc mot ung dung khac su dung. */
export class CameraInUseError extends Error {
  constructor() {
    super("Camera đang được dùng ở nơi khác.");
    this.name = "CameraInUseError";
  }
}

/** `OverconstrainedError` rieng le (rang buoc `facingMode` khong thoa man duoc). */
export class CameraOverconstrainedError extends Error {
  constructor() {
    super("Không thể mở camera với cấu hình yêu cầu.");
    this.name = "CameraOverconstrainedError";
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
 * Yeu cau camera SAU qua `facingMode` voi gia tri `ideal` (khong phai
 * `exact`): tren thiet bi chi co MOT camera, `exact` nem loi rang buoc du
 * camera do van dung duoc — `ideal` la mot goi y, khong phai mot dieu kien
 * chan. `audio` tat vi khong can ghi am cho bang chung cham cong.
 */
export async function openCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "NotAllowedError") {
      throw new CameraPermissionDeniedError();
    }
    // Ba loai loi con lai (NotFoundError, NotReadableError, OverconstrainedError)
    // duoc nem TIEP nguyen ban — plan 03-03 phan loai va noi UI rieng cho
    // tung loai bang ba lop loi da dinh nghia o tren.
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
 * Boc `getCurrentPosition` thanh Promise. `enableHighAccuracy` bat,
 * `maximumAge` bang 0 — MOI lan cham cong la MOT phep do moi, khong bao gio
 * dung vi tri cache cua lan truoc (mot nhan vien di chuyen giua hai lan cham
 * cong khong duoc phep "thua ke" toa do cu).
 */
export function acquireLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: GPS_TIMEOUT_MS,
      maximumAge: 0,
    });
  });
}
