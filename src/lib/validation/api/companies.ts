import { z } from "zod";

/**
 * Schema Zod dung CHUNG o ca hai dau (D-12d): `src/app/api/companies/route.ts`
 * parse truoc khi tra ve, `src/lib/data/companies.ts` parse sau khi nhan —
 * neu khong, `fetch` mat kieu end-to-end va `useDataQuery` se tra ve `any`.
 *
 * KHONG dua `company_id`/`companyId` hay bat ky dinh danh doanh nghiep nao
 * vao day — neu client gui them tham so, no bi bo qua vi schema khong khai
 * (D-12b).
 */

export const companyRoleSchema = z.enum([
  "owner",
  "admin",
  "manager",
  "employee",
]);

/**
 * Vai tro TRUY CAP — `companyRoleSchema` cong them `"support"` (D-51).
 *
 * Chi dung cho hinh dang PHAN HOI cua `GET /api/companies`, noi mot doanh
 * nghiep co the den tu mot phien ho tro thay vi mot membership. Moi cho khai
 * bao vai tro cho MOT NGUOI (form nhan vien, moi lenh ghi membership) van
 * dung `companyRoleSchema` — `"support"` khong bao gio ghi duoc vao database.
 */
export const accessRoleSchema = z.enum([
  "owner",
  "admin",
  "manager",
  "employee",
  "support",
]);

export const companySizeSchema = z.enum([
  "1-10",
  "11-30",
  "31-100",
  "101-500",
  "500+",
]);

export const companyAccentSchema = z.enum([
  "indigo",
  "navy",
  "ruby",
  "cream",
]);

export const companyRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  industry: z.string(),
  size: companySizeSchema,
  phone: z.string(),
  address: z.string(),
  role: accessRoleSchema,
  employeeCount: z.number(),
  lastAccessedAt: z.string(),
  accent: companyAccentSchema,
});

export const companyListResponseSchema = z.array(companyRowSchema);

export type CompanyRow = z.infer<typeof companyRowSchema>;
