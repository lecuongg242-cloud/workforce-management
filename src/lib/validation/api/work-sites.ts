import { z } from "zod";

/**
 * Schema Zod cho diem lam viec (plan 03-02), theo dung khuon `shifts.ts`
 * (D-12d):
 * - `workSiteRowSchema` — dong THO tu Supabase, transform snake_case ->
 *   camelCase, CHI dung o server ngay sau khi doc DB.
 * - `workSiteSchema` — hinh dang cuoi cung (camelCase), dung o CA HAI dau cho
 *   hop dong JSON.
 * - `workSiteListResponseSchema` — mang cua `workSiteSchema`.
 * - `workSiteInputSchema` — dau vao GHI (Server Action). Rang buoc so KHOP
 *   DUNG rang buoc CHECK cua `supabase/migrations/0005_v2_tables.sql`
 *   (latitude between -90 and 90, longitude between -180 and 180,
 *   radius_meters int > 0). KHONG khai bat ky truong dinh danh doanh nghiep
 *   nao (D-12b) — companyId luon tu `getSessionContext()` o tang Server
 *   Action, khong bao gio tu client.
 */

export const workSiteRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    radius_meters: z.number(),
    is_active: z.boolean(),
    created_at: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radius_meters,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));

/**
 * Hinh dang `WorkSite` cua domain.ts — dung o CA HAI dau cho hop dong JSON
 * (D-12d): Route Handler parse mang truoc khi tra ve, `src/lib/data/work-sites.ts`
 * parse lai sau khi nhan qua `fetchJson`.
 */
export const workSiteSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const workSiteListResponseSchema = z.array(workSiteSchema);

/**
 * Khop `WorkSiteInput` (`Omit<WorkSite, "id" | "companyId" | "createdAt">`)
 * o duong ghi. `.transform()` tra ve dong snake_case san sang ghi. Moi rang
 * buoc so kem thong diep tieng Viet tai dung o nhap lieu.
 */
export const workSiteInputSchema = z
  .object({
    name: z.string().min(1, "Vui lòng nhập tên điểm làm việc."),
    latitude: z
      .number({ invalid_type_error: "Vui lòng nhập vĩ độ." })
      .min(-90, "Vĩ độ phải từ -90 đến 90.")
      .max(90, "Vĩ độ phải từ -90 đến 90."),
    longitude: z
      .number({ invalid_type_error: "Vui lòng nhập kinh độ." })
      .min(-180, "Kinh độ phải từ -180 đến 180.")
      .max(180, "Kinh độ phải từ -180 đến 180."),
    radiusMeters: z
      .number({ invalid_type_error: "Vui lòng nhập bán kính." })
      .int("Bán kính phải là số nguyên (đơn vị mét).")
      .positive("Bán kính phải lớn hơn 0."),
    isActive: z.boolean(),
  })
  .transform((input) => ({
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
    radius_meters: input.radiusMeters,
    is_active: input.isActive,
  }));
