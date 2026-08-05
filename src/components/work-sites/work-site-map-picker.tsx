"use client";

import * as React from "react";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { searchPlaces, type GeocodePlace } from "@/lib/data/geocode";

import "leaflet/dist/leaflet.css";

/**
 * Chon toa do diem lam viec bang cach nhan len ban do hoac keo ghim.
 *
 * Dung Leaflet + anh ban do OpenStreetMap: mien phi, KHONG can khoa API nen
 * khong them mot nha cung cap phai cau hinh vao he thong (rang buoc trong
 * CLAUDE.md). Google Maps JS API doi khoa rieng va bat billing nen khong dung.
 *
 * Leaflet dung `window` ngay khi nap nen PHAI `import()` dong trong effect —
 * import tinh o dau tep se lam Server Component render hong o lan dau.
 */

type LeafletModule = typeof import("leaflet");
type LeafletMap = import("leaflet").Map;
type LeafletMarker = import("leaflet").Marker;
type LeafletCircle = import("leaflet").Circle;

export interface MapPosition {
  latitude: number;
  longitude: number;
}

/** Trung tam Viet Nam — chi dung khi CHUA chon vi tri nao. */
const OVERVIEW_CENTER: [number, number] = [16.047079, 108.20623];
const OVERVIEW_ZOOM = 5;
const PICKED_ZOOM = 17;

/** Khop voi `step="0.000001"` cua hai o toa do — ~0,1 m, du cho cham cong. */
function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Doc mau nhan tu token thay vi viet lai ma mau o day.
 *
 * PHAI giai ra gia tri that: Leaflet to mau hinh tron bang THUOC TINH SVG
 * (`setAttribute("stroke", ...)`), ma `var(--tf-primary)` trong thuoc tinh
 * trinh bay thi khong trinh duyet nao giai — hinh tron se ve mau den.
 * `globals.css` van la nguon su that duy nhat cua mau.
 */
function readBrandColor(): string {
  const token = getComputedStyle(document.documentElement)
    .getPropertyValue("--tf-primary")
    .trim();
  return token || "#533afd";
}

/**
 * Ghim ve bang divIcon thay vi anh mac dinh cua Leaflet: anh mac dinh tro toi
 * duong dan tuong doi trong goi npm, bundler khong giai duoc nen se vo ghim.
 */
function createPinIcon(L: LeafletModule) {
  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 24 24" fill="${readBrandColor()}" stroke="white" stroke-width="1.5" stroke-linejoin="round"><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/><circle cx="12" cy="10" r="3" fill="white" stroke="none"/></svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  });
}

export function WorkSiteMapPicker({
  latitude,
  longitude,
  radiusMeters,
  hasPosition,
  onPick,
}: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  /** `false` khi nguoi dung chua chon diem nao — ban do hien o muc toan quoc. */
  hasPosition: boolean;
  onPick: (position: MapPosition) => void;
}): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const leafletRef = React.useRef<LeafletModule | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const markerRef = React.useRef<LeafletMarker | null>(null);
  const circleRef = React.useRef<LeafletCircle | null>(null);

  const [isMapReady, setIsMapReady] = React.useState(false);
  const [isLocating, setIsLocating] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<GeocodePlace[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  // Tri hoan de khong goi dich vu tim kiem sau moi phim go — Nominatim la
  // han ngach dung chung, khong phai mot dich vu tra tien co the goi thoai
  // mai.
  const debouncedQuery = useDebounce(query, 500);

  // Giu tham chieu on dinh: effect tao ban do chi chay MOT lan nen khong duoc
  // dong kin (closure) lay `onPick` cua lan render dau.
  const onPickRef = React.useRef(onPick);
  React.useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  React.useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    void (async () => {
      const L = (await import("leaflet")).default;
      const container = containerRef.current;
      if (cancelled || !container) return;

      map = L.map(container, {
        center: OVERVIEW_CENTER,
        zoom: OVERVIEW_ZOOM,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      map.on("click", (event) => {
        onPickRef.current({
          latitude: round6(event.latlng.lat),
          longitude: round6(event.latlng.lng),
        });
      });

      leafletRef.current = L;
      mapRef.current = map;
      setIsMapReady(true);

      // Hop thoai mo kem hoat hinh nen o lan dau container chua co kich thuoc
      // that — khong goi lai thi Leaflet chi ve duoc mot phan anh ban do.
      window.setTimeout(() => map?.invalidateSize(), 0);
    })();

    return () => {
      cancelled = true;
      markerRef.current = null;
      circleRef.current = null;
      mapRef.current = null;
      leafletRef.current = null;
      map?.remove();
    };
  }, []);

  React.useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (!hasPosition) {
      markerRef.current?.remove();
      markerRef.current = null;
      circleRef.current?.remove();
      circleRef.current = null;
      return;
    }

    const position: [number, number] = [latitude, longitude];

    if (markerRef.current) {
      markerRef.current.setLatLng(position);
      // Chi doi khung nhin khi ghim ra ngoai man hinh — pan moi lan keo ghim
      // se giat va lam nguoi dung mat diem moc dang nhin.
      if (!map.getBounds().contains(position)) map.panTo(position);
    } else {
      markerRef.current = L.marker(position, {
        icon: createPinIcon(L),
        draggable: true,
        keyboard: true,
        title: "Kéo để chỉnh vị trí",
      })
        .addTo(map)
        .on("dragend", (event) => {
          const { lat, lng } = (event.target as LeafletMarker).getLatLng();
          onPickRef.current({ latitude: round6(lat), longitude: round6(lng) });
        });
      map.setView(position, PICKED_ZOOM);
    }

    if (circleRef.current) {
      circleRef.current.setLatLng(position);
      circleRef.current.setRadius(radiusMeters);
    } else {
      const brandColor = readBrandColor();
      circleRef.current = L.circle(position, {
        radius: radiusMeters,
        color: brandColor,
        weight: 2,
        fillColor: brandColor,
        fillOpacity: 0.12,
      }).addTo(map);
    }
  }, [isMapReady, hasPosition, latitude, longitude, radiusMeters]);

  React.useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    // Truy van cu tra ve SAU truy van moi se ghi de ket qua dung bang ket qua
    // cu — co `cancelled` de lan chay da bi thay the khong con ghi state nua.
    let cancelled = false;
    setIsSearching(true);
    searchPlaces(trimmed)
      .then((places) => {
        if (!cancelled) setResults(places);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const handleSelectPlace = (place: GeocodePlace): void => {
    onPickRef.current({
      latitude: round6(place.latitude),
      longitude: round6(place.longitude),
    });
    // Doi khung nhin ve dia diem vua chon: `setView` o effect dong bo chi
    // chay cho lan dat ghim DAU TIEN, cac lan sau no co y khong keo ban do
    // theo (tranh giat khi keo ghim) — nen o day phai tu doi.
    mapRef.current?.setView([place.latitude, place.longitude], PICKED_ZOOM);
    setQuery("");
    setResults([]);
  };

  const handleUseCurrentPosition = (): void => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt không hỗ trợ lấy vị trí hiện tại.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        onPickRef.current({
          latitude: round6(position.coords.latitude),
          longitude: round6(position.coords.longitude),
        });
      },
      () => {
        setIsLocating(false);
        toast.error(
          "Không lấy được vị trí hiện tại. Hãy cho phép truy cập vị trí hoặc chọn trực tiếp trên bản đồ.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="grid gap-2">
      {/* `relative` de danh sach ket qua noi TREN ban do — Leaflet dat cac
          lop cua no o z-index 400-700 nen danh sach phai cao hon the. */}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm địa chỉ hoặc tên địa điểm…"
          aria-label="Tìm địa điểm"
          autoComplete="off"
          className="pl-9"
        />
        {isSearching ? (
          <Loader2
            aria-hidden="true"
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-muted"
          />
        ) : null}

        {results.length > 0 ? (
          <ul className="absolute top-[calc(100%+4px)] right-0 left-0 z-[1000] max-h-56 overflow-y-auto rounded-control border border-hairline bg-white py-1 shadow-e2">
            {results.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => handleSelectPlace(place)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-canvas-soft"
                >
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-ink-muted"
                  />
                  <span>{place.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {!isSearching && debouncedQuery.trim().length >= 3 && results.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-ink-muted">
            Không tìm thấy địa điểm nào. Bạn có thể nhấn thẳng lên bản đồ để
            chọn vị trí.
          </p>
        ) : null}
      </div>

      <div
        ref={containerRef}
        role="application"
        aria-label="Bản đồ chọn vị trí điểm làm việc"
        className="h-64 w-full overflow-hidden rounded-control border border-hairline bg-canvas-soft"
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-muted">
          {hasPosition
            ? "Nhấn lên bản đồ hoặc kéo ghim để chỉnh vị trí."
            : "Nhấn lên bản đồ để chọn vị trí điểm làm việc."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentPosition}
          disabled={isLocating}
        >
          {isLocating ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin" />
              Đang lấy…
            </>
          ) : (
            <>
              <Crosshair aria-hidden="true" />
              Vị trí của tôi
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
