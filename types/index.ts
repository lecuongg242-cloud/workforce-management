export type TenantRole = 'OWNER' | 'ADMIN' | 'HR' | 'MANAGER' | 'ACCOUNTANT' | 'EMPLOYEE';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  plan_type: string;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TenantRole;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  parent_dept_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  tenant_id: string;
  user_id?: string;
  department_id?: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  hire_date?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UserTenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  role: TenantRole;
  created_at: string;
}
