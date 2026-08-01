import { z } from "zod";

/**
 * Schema Zod cho nhan vien (plan 02-05). Employee co ~20 truong nen phep anh
 * xa snake_case (cot Postgres) -> camelCase (domain.ts) song o NGAY TRONG
 * `employeeRowSchema` (transform) thay vi mot object literal tay o Route
 * Handler nhu `companies.ts` — mot noi duy nhat dinh nghia phep anh xa, it
 * sai sot hon khi so luong truong lon.
 *
 * `employeeSchema` (khong transform, cung hinh dang voi ket qua cua
 * `employeeRowSchema`) la schema dung o CA HAI dau cho hop dong JSON cuoi
 * cung (D-12d): Route Handler parse mang da-anh-xa truoc khi tra ve,
 * `src/lib/data/employees.ts` parse lai sau khi nhan qua `fetchJson`.
 */

export const employeeStatusSchema = z.enum([
  "active",
  "on_leave",
  "terminated",
  "pending_invite",
]);

export const contractTypeSchema = z.enum([
  "full_time",
  "part_time",
  "probation",
  "seasonal",
  "intern",
]);

export const genderSchema = z.enum(["male", "female", "other"]);

export const systemRoleSchema = z.enum(["owner", "admin", "manager", "employee"]);

/**
 * Dong tho tu Supabase (`select("*")` tren bang `employees`) — CHI dung o
 * server, ngay sau khi doc du lieu, de chuyen sang hinh dang `Employee`.
 */
export const employeeRowSchema = z
  .object({
    id: z.string(),
    company_id: z.string(),
    code: z.string(),
    full_name: z.string(),
    email: z.string(),
    phone: z.string(),
    date_of_birth: z.string(),
    gender: genderSchema,
    avatar_url: z.string().nullable(),
    department_id: z.string(),
    position: z.string(),
    contract_type: contractTypeSchema,
    start_date: z.string(),
    manager_id: z.string().nullable(),
    shift_id: z.string(),
    work_location: z.string(),
    status: employeeStatusSchema,
    system_role: systemRoleSchema,
    invitation_sent: z.boolean(),
    can_view_payslip: z.boolean(),
    can_check_in_remotely: z.boolean(),
  })
  .transform((row) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    avatarUrl: row.avatar_url,
    departmentId: row.department_id,
    position: row.position,
    contractType: row.contract_type,
    startDate: row.start_date,
    managerId: row.manager_id,
    shiftId: row.shift_id,
    workLocation: row.work_location,
    status: row.status,
    systemRole: row.system_role,
    invitationSent: row.invitation_sent,
    canViewPayslip: row.can_view_payslip,
    canCheckInRemotely: row.can_check_in_remotely,
  }));

/** Hinh dang `Employee` cua domain.ts — dung o ca hai dau (D-12d). */
export const employeeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  dateOfBirth: z.string(),
  gender: genderSchema,
  avatarUrl: z.string().nullable(),
  departmentId: z.string(),
  position: z.string(),
  contractType: contractTypeSchema,
  startDate: z.string(),
  managerId: z.string().nullable(),
  shiftId: z.string(),
  workLocation: z.string(),
  status: employeeStatusSchema,
  systemRole: systemRoleSchema,
  invitationSent: z.boolean(),
  canViewPayslip: z.boolean(),
  canCheckInRemotely: z.boolean(),
});

export const paginatedEmployeeSchema = z.object({
  items: z.array(employeeSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export const employeeListResponseSchema = z.array(employeeSchema);

/**
 * Sau tham so duy nhat cua truy van phan trang — KHONG khai bat ky truong
 * dinh danh doanh nghiep nao, nen mot tham so gia mao bi bo qua (D-12b).
 */
export const employeeQuerySchema = z.object({
  search: z.string().trim().optional(),
  departmentId: z.string().optional(),
  status: z.union([employeeStatusSchema, z.literal("all")]).optional(),
  contractType: z.union([contractTypeSchema, z.literal("all")]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type EmployeeRow = z.infer<typeof employeeSchema>;
