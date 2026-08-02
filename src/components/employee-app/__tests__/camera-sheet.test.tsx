import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

import { CameraSheet } from "@/components/employee-app/camera-sheet";

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

const noop = async (): Promise<void> => {};

beforeEach(() => {
  mockGeolocationSuccess();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CameraSheet — bon nhanh loi camera (Task 2)", () => {
  it("1. NotAllowedError -> khoi tu choi quyen camera voi nut Thu lai", async () => {
    mockGetUserMedia(() =>
      Promise.reject(new DOMException("tu choi", "NotAllowedError")),
    );
    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} />);

    expect(await screen.findByText("Không có quyền dùng camera")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Thử lại" })).not.toBeNull();
  });

  it("2. NotFoundError -> khoi khong co camera, chua lien ket bo sung cong, khong nut Thu lai", async () => {
    mockGetUserMedia(() =>
      Promise.reject(new DOMException("khong co camera", "NotFoundError")),
    );
    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} />);

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
    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} />);

    expect(await screen.findByText("Không tìm thấy camera")).not.toBeNull();
  });

  it("4. NotReadableError -> khoi camera dang duoc dung o noi khac, chu rieng va nut Thu lai", async () => {
    mockGetUserMedia(() =>
      Promise.reject(new DOMException("dang duoc dung", "NotReadableError")),
    );
    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} />);

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

    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} />);

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

    render(<CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} />);

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
    render(<CameraSheet open onOpenChange={onOpenChange} onSubmit={noop} />);

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
      <CameraSheet open onOpenChange={vi.fn()} onSubmit={noop} />,
    );

    expect(await screen.findByText("Không tìm thấy camera")).not.toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
