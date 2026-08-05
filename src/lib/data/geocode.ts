import { fetchJson } from "@/lib/data/fetch-json";
import {
  geocodeListResponseSchema,
  type GeocodePlace,
} from "@/lib/validation/api/geocode";

/**
 * Tim dia diem theo ten/dia chi cho o tim kiem cua ban do chon diem lam viec.
 * Di qua `GET /api/geocode` (proxy phia server) chu KHONG goi thang dich vu
 * ngoai tu trinh duyet — xem ly do o chinh Route Handler do.
 */
export async function searchPlaces(query: string): Promise<GeocodePlace[]> {
  const trimmed = query.trim();
  // Chan o day luon de khong ton mot vong mang cho truy van chac chan rong —
  // Route Handler van kiem lai (khong tin dieu kien phia client).
  if (trimmed.length < 3) return [];
  return fetchJson(
    `/api/geocode?q=${encodeURIComponent(trimmed)}`,
    geocodeListResponseSchema,
  );
}

export type { GeocodePlace };
