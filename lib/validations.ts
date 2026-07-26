import { z } from 'zod';

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100),
  description: z.string().max(500).optional(),
  parentDeptId: z.string().uuid().optional().or(z.literal('')),
});

export const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required').max(50),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  position: z.string().optional().or(z.literal('')),
  hireDate: z.string().optional().or(z.literal('')),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'on_leave']).default('active'),
});

export const updateEmployeeSchema = createEmployeeSchema;

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
