import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Muoi hanh vi cua `<behavior>` (03-03-PLAN.md Task 1): nam nhanh
 * `getUserMedia` (bon phan loai cong mot nhanh la), mot khang dinh rang buoc
 * dung `ideal`, hai nhanh geolocation, mot khang dinh ba tuy chon
 * geolocation dung gia tri, va mot khang dinh `closeCamera` dung tung track
 * cua mot luong hai track. Cong them `compressPhoto` (nen thanh cong + nen
 * hong tra lai anh goc).
 *
 * Khuon gan `navigator.mediaDevices`/`navigator.geolocation` bang
 * `Object.defineProperty` theo RESEARCH.md §"Testing" — jsdom khong trien
 * khai hai API nay nen phai tu gan truoc moi test.
 */

const compressionMock = vi.fn();
vi.mock("browser-image-compression", () => ({
  default: (...args: unknown[]) => compressionMock(...args),
}));

function mockGetUserMedia(impl: () => Promise<MediaStream>): void {
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(impl) },
  });
}

function mockGeolocation(
  impl: (
    success: PositionCallback,
    error?: PositionErrorCallback,
  ) => void,
): void {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn(impl) },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("openCamera — phan loai DOMException thanh bon lop loi rieng", () => {
  it("1. NotAllowedError -> CameraPermissionDeniedError", async () => {
    const { openCamera, CameraPermissionDeniedError } = await import(
      "@/lib/attendance/camera"
    );
    mockGetUserMedia(() =>
      Promise.reject(new DOMException("tu choi quyen", "NotAllowedError")),
    );
    await expect(openCamera()).rejects.toBeInstanceOf(
      CameraPermissionDeniedError,
    );
  });

  it("2. NotFoundError -> NoCameraDeviceError", async () => {
    const { openCamera, NoCameraDeviceError } = await import(
      "@/lib/attendance/camera"
    );
    mockGetUserMedia(() =>
      Promise.reject(new DOMException("khong co camera", "NotFoundError")),
    );
    await expect(openCamera()).rejects.toBeInstanceOf(NoCameraDeviceError);
  });

  it("3. OverconstrainedError -> NoCameraDeviceError (cung mot loi thoat voi NotFoundError)", async () => {
    const { openCamera, NoCameraDeviceError } = await import(
      "@/lib/attendance/camera"
    );
    mockGetUserMedia(() =>
      Promise.reject(
        new DOMException("rang buoc khong thoa man", "OverconstrainedError"),
      ),
    );
    await expect(openCamera()).rejects.toBeInstanceOf(NoCameraDeviceError);
  });

  it("4. NotReadableError -> CameraInUseError", async () => {
    const { openCamera, CameraInUseError } = await import(
      "@/lib/attendance/camera"
    );
    mockGetUserMedia(() =>
      Promise.reject(new DOMException("dang duoc dung", "NotReadableError")),
    );
    await expect(openCamera()).rejects.toBeInstanceOf(CameraInUseError);
  });

  it("5. Ten loi la (khac bon ten da biet) duoc nem tiep nguyen ban, khong bi gop vao mot lop loi sai", async () => {
    const { openCamera } = await import("@/lib/attendance/camera");
    const strangeError = new DOMException("loi la", "SecurityError");
    mockGetUserMedia(() => Promise.reject(strangeError));
    await expect(openCamera()).rejects.toBe(strangeError);
  });

  it("6. Rang buoc gui vao getUserMedia dung 'ideal' cho facingMode, khong dung 'exact'", async () => {
    const { openCamera } = await import("@/lib/attendance/camera");
    const fakeStream = { getTracks: () => [] } as unknown as MediaStream;
    let capturedConstraints: MediaStreamConstraints | undefined;
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn((constraints: MediaStreamConstraints) => {
          capturedConstraints = constraints;
          return Promise.resolve(fakeStream);
        }),
      },
    });

    await openCamera();

    const video = capturedConstraints?.video;
    expect(video).toMatchObject({ facingMode: { ideal: "environment" } });
    expect(JSON.stringify(video)).not.toContain("exact");
  });
});

describe("acquireLocation — phan loai GeolocationPositionError", () => {
  it("7. PERMISSION_DENIED -> LocationPermissionDeniedError", async () => {
    const { acquireLocation, LocationPermissionDeniedError } = await import(
      "@/lib/attendance/camera"
    );
    mockGeolocation((_success, error) => {
      error?.({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: "tu choi",
      } as GeolocationPositionError);
    });
    await expect(acquireLocation()).rejects.toBeInstanceOf(
      LocationPermissionDeniedError,
    );
  });

  it("8. TIMEOUT -> LocationTimeoutError", async () => {
    const { acquireLocation, LocationTimeoutError } = await import(
      "@/lib/attendance/camera"
    );
    mockGeolocation((_success, error) => {
      error?.({
        code: 3,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: "het gio",
      } as GeolocationPositionError);
    });
    await expect(acquireLocation()).rejects.toBeInstanceOf(
      LocationTimeoutError,
    );
  });

  it("9. getCurrentPosition duoc goi voi timeout = GPS_TIMEOUT_MS va maximumAge = 0", async () => {
    const { acquireLocation, GPS_TIMEOUT_MS } = await import(
      "@/lib/attendance/camera"
    );
    let capturedOptions: PositionOptions | undefined;
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(
          (
            success: PositionCallback,
            _error: PositionErrorCallback,
            options: PositionOptions,
          ) => {
            capturedOptions = options;
            success({
              coords: { latitude: 21.0285, longitude: 105.8542, accuracy: 12 },
            } as GeolocationPosition);
          },
        ),
      },
    });

    await acquireLocation();

    expect(capturedOptions).toMatchObject({
      enableHighAccuracy: true,
      timeout: GPS_TIMEOUT_MS,
      maximumAge: 0,
    });
  });
});

describe("closeCamera — dung tung track cua luong", () => {
  it("10. Dung ca hai track khi luong co nhieu hon mot track", async () => {
    const { closeCamera } = await import("@/lib/attendance/camera");
    const stop1 = vi.fn();
    const stop2 = vi.fn();
    const fakeStream = {
      getTracks: () => [{ stop: stop1 }, { stop: stop2 }],
    } as unknown as MediaStream;

    closeCamera(fakeStream);

    expect(stop1).toHaveBeenCalledTimes(1);
    expect(stop2).toHaveBeenCalledTimes(1);
  });
});

describe("compressPhoto — nen anh, khong bao gio chan lan cham cong", () => {
  beforeEach(() => {
    compressionMock.mockReset();
  });

  it("11. Tra ve mot Blob nho hon hoac bang dau vao khi nen thanh cong", async () => {
    const { compressPhoto } = await import("@/lib/attendance/camera");
    const original = new Blob(["a".repeat(1000)], { type: "image/jpeg" });
    const compressed = new Blob(["a".repeat(100)], { type: "image/jpeg" });
    compressionMock.mockResolvedValue(compressed);

    const result = await compressPhoto(original);

    expect(result.size).toBeLessThanOrEqual(original.size);
    expect(compressionMock).toHaveBeenCalledTimes(1);
  });

  it("12. Khong bao gio nem loi khi dau vao la JPEG hop le — nen hong thi tra lai anh goc", async () => {
    const { compressPhoto } = await import("@/lib/attendance/camera");
    const original = new Blob(["a".repeat(1000)], { type: "image/jpeg" });
    compressionMock.mockRejectedValue(new Error("nen that bai"));

    const result = await compressPhoto(original);

    expect(result).toBe(original);
  });
});
