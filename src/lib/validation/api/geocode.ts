import { z } from "zod";

/**
 * Schema cho tim kiem dia diem (Nominatim cua OpenStreetMap). Khuon hai dau
 * (D-12d) giong cac schema API khac: `nominatimPlaceSchema` la dong THO tu
 * dich vu ngoai, `geocodePlaceSchema` la hinh dang cuoi cung dung o ca hai
 * dau.
 */

/**
 * Dong tho tu Nominatim. `lat`/`lon` ve dang CHUOI (khong phai so) — dich vu
 * ngoai khong bi rang buoc boi hop dong cua ta nen phai ep kieu tuong minh o
 * day chu khong tin vao kieu.
 */
export const nominatimPlaceSchema = z
  .object({
    place_id: z.union([z.number(), z.string()]),
    display_name: z.string(),
    lat: z.string(),
    lon: z.string(),
  })
  .transform((row) => ({
    id: String(row.place_id),
    displayName: row.display_name,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
  }))
  // Toa do khong doc duoc thi loai dong do — mot ket qua khong dat duoc ghim
  // len ban do la mot ket qua vo dung, khong phai mot ket qua "gan dung".
  .refine(
    (place) =>
      Number.isFinite(place.latitude) &&
      Number.isFinite(place.longitude) &&
      Math.abs(place.latitude) <= 90 &&
      Math.abs(place.longitude) <= 180,
    { message: "Toạ độ không hợp lệ." },
  );

/** Hinh dang cuoi cung — dung o CA HAI dau (D-12d). */
export const geocodePlaceSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export const geocodeListResponseSchema = z.array(geocodePlaceSchema);

export type GeocodePlace = z.infer<typeof geocodePlaceSchema>;

/**
 * Tham so truy van. `q` toi thieu 3 ky tu: goi dich vu ngoai cho mot hai ky
 * tu vua khong ra ket qua dung vua tieu quota dung chung mot cach vo ich.
 */
export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(3).max(120),
});
