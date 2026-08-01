import { z } from "zod";

/**
 * Schema Zod cho phong ban (plan 02-05). Khac voi `employees.ts`, phong ban
 * chi co 5 truong nen phep anh xa snake_case -> camelCase van lam thu cong o
 * Route Handler (giong khuon `companies.ts` cua plan 02-04) — Zod chi xac
 * nhan hinh dang cuoi cung, dung o ca hai dau (D-12d).
 */

export const departmentStatusSchema = z.enum(["active", "inactive"]);

export const departmentWithStatsSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  description: z.string(),
  managerId: z.string().nullable(),
  status: departmentStatusSchema,
  employeeCount: z.number(),
  managerName: z.string().nullable(),
});

export const departmentListResponseSchema = z.array(departmentWithStatsSchema);

/** Khop `DepartmentInput` (`Omit<Department, "id" | "companyId">`) o duong ghi. */
export const departmentInputSchema = z.object({
  name: z.string(),
  description: z.string(),
  managerId: z.string().nullable(),
  status: departmentStatusSchema,
});

export type DepartmentWithStatsRow = z.infer<typeof departmentWithStatsSchema>;
