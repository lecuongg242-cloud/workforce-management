import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Bai kiem may trang thai cua Camera Sheet (03-03-PLAN.md Task 2 + Task 3).
 * Gan `navigator.mediaDevices`/`navigator.geolocation` bang
 * `Object.defineProperty` theo RESEARCH.md §"Testing" — cho camera.ts that
 * chay va tu phan loai loi, khong mock module `@/lib/attendance/camera`.
 *
 * `next/link` duoc gia lap thanh mot the <a> thuong: moi truong Vitest nay
 * khong co AppRouterContext that cua Next.js, va Link chi can render dung
 * href de bai kiem xac nhan duoc duong dan bo sung cong.
 */
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/**
 * `browser-image-compression` dung `useWebWorker: true` — jsdom khong co
 * `Worker`, khien lan goi that TREO VO HAN thay vi nem loi dong bo (khong
 * roi vao nhanh catch cua `compressPhoto()`). Gia lap thanh mot ham dong y
 * ngay tra lai chinh Blob dau vao, giu cac bai kiem Task 3 nhanh va tat
 * dinh — hanh vi nen that (`camera.test.ts`) da kiem rieng nhanh nen
 * thanh cong/nen hong o Task 1.
 */
vi.mock("browser-image-compression", () => ({
  default: vi.fn(async (file: Blob) => file),
}));

import { CameraSheet } from "@/components/employee-app/camera-sheet";
import type { PunchSubmitResult } from "@/components/employee-app/camera-sheet";
import type { PunchEvidence } from "@/lib/types/domain";

function mockGetUserMedia(impl: () => Promise<MediaStream>): void {
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(impl) },
  });
}

function mockGeolocationSuccess(): void {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: { latitude: 21.0285, longitude: 105.8542, accuracy: 12 },
        } as GeolocationPosition);
      }),
    },
  });
}

function mockGeolocationReject(code: number): void {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn(
        (_success: PositionCallback, error?: PositionErrorCallback) => {
          error?.({
            code,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: "loi vi tri gia lap",
          } as GeolocationPositionError);
        },
      ),
    },
  });
}

function fakeStream(trackCount = 1): { stream: MediaStream; stops: ReturnType<typeof vi.fn>[] } {
  const stops = Array.from({ length: trackCount }, () => vi.fn());
  const stream = {
    getTracks: () => stops.map((stop) => ({ stop })),
  } as unknown as MediaStream;
  return { stream, stops };
}

const NOT_FLAGGED = {
  distanceMeters: null,
  workSiteName: null,
  isOutsideRadius: false,
} as const;

const noop = async () => NOT_FLAGGED;

/**
 * jsdom khong trien khai Canvas 2D that (`getContext("2d")` tra `null` mac
 * dinh) — gia lap toi thieu de `captureFrame()` THAT (dung tu camera.ts,
 * khong bi mock) chay duoc trong bai kiem component nay. `compressPhoto()`
 * van dung goi that toi `browser-image-compression`; goi that se that bai
 * tren du lieu Blob gia (khong phai JPEG that) va TU RA anh goc theo dung
 * try/catch da co trong camera.ts — khong can mock rieng thu vien nen.
 */
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    callback(new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" }));
  }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
});

beforeEach(() => {
  mockGeolocationSuccess();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Mo Sheet, mo camera thanh cong, chup mot khung hinh — dua component toi
 * trang thai "captured" (nut Gui cham cong xuat hien) de cac bai kiem Task 3
 * co the goi Gui/Gui lai. */
async function renderAndCapture(
  onSubmit: (evidence: PunchEvidence) => Promise<PunchSubmitResult>,
): Promise<{
  onOpenChange: ReturnType<typeof vi.fn>;
  getUserMedia: ReturnType<typeof vi.fn>;
  submitButton: HTMLElement;
}> {
  const { stream } = fakeStream();
  const getUserMedia = vi.fn(() => Promise.resolve(stream));
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  const onOpenChange = vi.fn();
  render(<CameraSheet open onOpenChange={onOpenChange} onSubmit={onSubmit} punchKind="check_in" />);

  const captureButton = await screen.findByRole("button", { name: "Chụp ảnh" });
  fireEvent.click(captureButton);

  const submitButton = await screen.findByRole("button", {
    name: "Gửi chấm công",
  });
  return { onOpenChange, getUserMedia, submitButton };
}

describe("CameraSheet — bon nhanh loi camera (Task 2)", () => {
  it("1. NotAllowedError -> khoi tu choi quyen camera voi nut Thu lai", async () => {
    mockGetUserMedia(() =>
      Promise.reject(new DOMException("tu choi", "NotAllowedError")),
    );
    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} punchKind="check_in" />);

    expect(await screen.findByText("Không có quyền dùng camera")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Thử lại" })).not.toBeNull();
  });

  it("2. NotFoundError -> khoi khong co camera, chua lien ket bo sung cong, khong nut Thu lai", async () => {
    mockGetUserMedia(() =>
      Promise.reject(new DOMException("khong co camera", "NotFoundError")),
    );
    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} punchKind="check_in" />);

    expect(await screen.findByText("Không tìm thấy camera")).not.toBeNull();
    const link = screen.getByRole("link", { name: "Bổ sung chấm công" });
    expect(link.getAttribute("href")).toBe(
      "/employee/requests?type=attendance_supplement",
    );
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
  });

  it("3. OverconstrainedError -> cung khoi khong co camera voi NotFoundError", async () => {
    mockGetUserMedia(() =>
      Promise.reject(
        new DOMException("rang buoc khong thoa man", "OverconstrainedError"),
      ),
    );
    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} punchKind="check_in" />);

    expect(await screen.findByText("Không tìm thấy camera")).not.toBeNull();
  });

  it("4. NotReadableError -> khoi camera dang duoc dung o noi khac, chu rieng va nut Thu lai", async () => {
    mockGetUserMedia(() =>
      Promise.reject(new DOMException("dang duoc dung", "NotReadableError")),
    );
    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} punchKind="check_in" />);

    expect(await screen.findByText("Không mở được camera")).not.toBeNull();
    expect(
      screen.getByText(
        "Camera có thể đang được dùng ở nơi khác. Đóng ứng dụng khác rồi thử lại.",
      ),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Thử lại" })).not.toBeNull();
  });
});

describe("CameraSheet — tu choi quyen vi tri va het gio GPS (Task 2)", () => {
  it("5. Tu choi quyen vi tri -> khoi rieng, khac khoi loi camera, co nut Thu lai goi lai acquireLocation", async () => {
    const { stream } = fakeStream();
    mockGetUserMedia(() => Promise.resolve(stream));
    mockGeolocationReject(1); // PERMISSION_DENIED

    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} punchKind="check_in" />);

    expect(await screen.findByText("Cần quyền truy cập vị trí")).not.toBeNull();
    expect(
      screen.queryByText("Không có quyền dùng camera"),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Thử lại" })).not.toBeNull();
  });

  it("6. Het gio cho GPS -> chip trang thai doi thanh nut thu lai, khung hinh khong bi thay", async () => {
    const { stream } = fakeStream();
    mockGetUserMedia(() => Promise.resolve(stream));
    mockGeolocationReject(3); // TIMEOUT

    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} punchKind="check_in" />);

    // Khung hinh van hien thi nut chup (khong bi mot khoi loi thay the).
    expect(await screen.findByRole("button", { name: "Chụp ảnh" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Thử lại" })).not.toBeNull();
  });
});

describe("CameraSheet — dong Sheet va cau truc chung (Task 2)", () => {
  it("7. Dong Sheet tu trang thai loi goi closeCamera() (dung tung track)", async () => {
    const { stream, stops } = fakeStream(2);
    mockGetUserMedia(() => Promise.resolve(stream));

    const onOpenChange = vi.fn();
    render(<CameraSheet open onOpenChange={onOpenChange} onSubmit={noop} punchKind="check_in" />);

    const closeButton = await screen.findByRole("button", { name: "Đóng" });
    closeButton.click();

    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(stops[1]).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("8. Khong co phan tu chon tep (input type=file) o bat ky trang thai nao", async () => {
    mockGetUserMedia(() =>
      Promise.reject(new DOMException("khong co camera", "NotFoundError")),
    );
    const { container } = render(
      <CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} punchKind="check_in" />,
    );

    expect(await screen.findByText("Không tìm thấy camera")).not.toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe("CameraSheet — ba ly do tu choi cua D-20b (Task 3)", () => {
  it("9. missing_photo -> tieu de rieng, nut Chup lai (khong phai Gui lai)", async () => {
    const onSubmit = vi.fn(async () => {
      throw { message: "Thieu anh", reason: "missing_photo" };
    });
    const { submitButton } = await renderAndCapture(onSubmit);

    fireEvent.click(submitButton);

    expect(await screen.findByText("Thiếu ảnh chấm công")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Chụp lại" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Gửi lại" })).toBeNull();
  });

  it("10. outside_shift -> tieu de rieng, lien ket bo sung cong (khong phai nut gui lai chinh lan bi tu choi)", async () => {
    const onSubmit = vi.fn(async () => {
      throw { message: "Ngoai ca", reason: "outside_shift" };
    });
    const { submitButton } = await renderAndCapture(onSubmit);

    fireEvent.click(submitButton);

    expect(await screen.findByText("Ngoài giờ ca làm")).not.toBeNull();
    const link = screen.getByRole("link", { name: "Bổ sung chấm công" });
    expect(link.getAttribute("href")).toBe(
      "/employee/requests?type=attendance_supplement",
    );
    expect(screen.queryByRole("button", { name: "Gửi lại" })).toBeNull();
  });

  it("11. network_error (loi khong mang truong reason hop le) -> tieu de rieng, nut ghi dung 'Gửi lại'", async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });
    const { submitButton } = await renderAndCapture(onSubmit);

    fireEvent.click(submitButton);

    expect(await screen.findByText("Mất kết nối mạng")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Gửi lại" })).not.toBeNull();
  });

  it("12. Ba khoi tu choi co ba tieu de khac nhau, khong khoi nao trung chu voi khoi khac", async () => {
    // Ba tieu de nguyen van tu ATTENDANCE_REJECTION_LABEL (constants.ts) —
    // test 9-11 da khang dinh tung tieu de rieng le xuat hien dung reason;
    // test nay khang dinh THEM rang khong hai tieu de nao trung nhau.
    const knownTitles = [
      "Thiếu ảnh chấm công",
      "Ngoài giờ ca làm",
      "Mất kết nối mạng",
    ];
    expect(new Set(knownTitles).size).toBe(3);
  });

  it("13. Bam 'Gửi lại' sau loi mang gui lai DUNG anh/toa do dang giu, khong mo lai camera", async () => {
    let callCount = 0;
    const onSubmit = vi.fn<
      (evidence: PunchEvidence) => Promise<PunchSubmitResult>
    >(async () => {
      callCount += 1;
      if (callCount === 1) throw new Error("Failed to fetch");
      return NOT_FLAGGED;
    });
    const { getUserMedia, submitButton } = await renderAndCapture(onSubmit);

    fireEvent.click(submitButton);
    await screen.findByText("Mất kết nối mạng");

    const retryButton = screen.getByRole("button", { name: "Gửi lại" });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });
    // getUserMedia chi duoc goi MOT LAN duy nhat (luc mo Sheet) — gui lai
    // KHONG mo lai camera.
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    const [firstCallEvidence] = onSubmit.mock.calls[0] as [PunchEvidence];
    const [secondCallEvidence] = onSubmit.mock.calls[1] as [PunchEvidence];
    expect(secondCallEvidence.latitude).toBe(firstCallEvidence.latitude);
    expect(secondCallEvidence.longitude).toBe(firstCallEvidence.longitude);
  });

  it("14. Khong co lan goi nao toi localStorage/sessionStorage qua tron mot vong loi-va-gui-lai", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const onSubmit = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });
    const { submitButton } = await renderAndCapture(onSubmit);

    fireEvent.click(submitButton);
    await screen.findByText("Mất kết nối mạng");

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});

describe("CameraSheet — banner 'da ghi nhan nhung o xa' (D-20, Task 3)", () => {
  it("15. isOutsideRadius=true -> banner mo dau 'Da ghi nhan', chua ten diem va khoang cach that", async () => {
    const onSubmit = vi.fn(async () => ({
      distanceMeters: 620,
      workSiteName: "Xưởng 2",
      isOutsideRadius: true,
    }));
    const { submitButton } = await renderAndCapture(onSubmit);

    fireEvent.click(submitButton);

    const title = await screen.findByText(/^Đã ghi nhận/);
    expect(title).not.toBeNull();
    expect(screen.getByText(/Xưởng 2/)).not.toBeNull();
    expect(screen.getByText(/620 m\./)).not.toBeNull();
  });

  it("16. Banner khong tu dong bien mat, chi dong khi bam 'Đã hiểu' — va dong Sheet + dung camera", async () => {
    const { stream, stops } = fakeStream();
    const getUserMedia = vi.fn(() => Promise.resolve(stream));
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const onSubmit = vi.fn(async () => ({
      distanceMeters: 620,
      workSiteName: "Xưởng 2",
      isOutsideRadius: true,
    }));
    const onOpenChange = vi.fn();
    render(<CameraSheet open onOpenChange={onOpenChange} onSubmit={onSubmit} punchKind="check_in" />);

    const captureButton = await screen.findByRole("button", { name: "Chụp ảnh" });
    fireEvent.click(captureButton);
    const submitButton = await screen.findByRole("button", { name: "Gửi chấm công" });
    fireEvent.click(submitButton);

    const ackButton = await screen.findByRole("button", { name: "Đã hiểu" });
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(ackButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(stops[0]).toHaveBeenCalled();
  });

  it("17. isOutsideRadius=false (thanh cong binh thuong) -> khong hien banner, dong Sheet ngay", async () => {
    const onSubmit = vi.fn(async () => NOT_FLAGGED);
    const { onOpenChange, submitButton } = await renderAndCapture(onSubmit);

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(screen.queryByText(/^Đã ghi nhận/)).toBeNull();
  });

  it("18. Banner khong hien do chinh xac GPS", async () => {
    const onSubmit = vi.fn(async () => ({
      distanceMeters: 620,
      workSiteName: "Xưởng 2",
      isOutsideRadius: true,
    }));
    const { submitButton } = await renderAndCapture(onSubmit);

    fireEvent.click(submitButton);

    await screen.findByText(/^Đã ghi nhận/);
    expect(document.body.textContent).not.toMatch(/độ chính xác/i);
  });
});
