'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { getUserRoleInTenant } from '@/lib/actions/tenant';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from '@/lib/validations';
import type { Employee } from '@/types';

// Helper function to validate tenant access
async function validateTenantAccess(
  tenantId: string,
  allowedRoles: string[] = ['OWNER', 'ADMIN', 'HR']
) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const userRole = await getUserRoleInTenant(tenantId);
  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new Error('Access denied');
  }

  return true;
}

export async function getEmployees(
  tenantId: string,
  filters?: {
    departmentId?: string;
    status?: string;
    search?: string;
  }
): Promise<Employee[]> {
  try {
    await validateTenantAccess(tenantId, ['OWNER', 'ADMIN', 'HR', 'MANAGER', 'ACCOUNTANT', 'EMPLOYEE']);

    const supabase = await createClient();

    let query = supabase
      .from('employees')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (filters?.departmentId) {
      query = query.eq('department_id', filters.departmentId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching employees:', error);
      return [];
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      return (data || []).filter(
        (emp) =>
          emp.first_name.toLowerCase().includes(searchLower) ||
          emp.last_name.toLowerCase().includes(searchLower) ||
          emp.employee_code.toLowerCase().includes(searchLower) ||
          (emp.email?.toLowerCase().includes(searchLower) || false)
      );
    }

    return data || [];
  } catch (error) {
    console.error('Error in getEmployees:', error);
    return [];
  }
}

export async function getEmployeeById(tenantId: string, employeeId: string): Promise<Employee | null> {
  try {
    await validateTenantAccess(tenantId);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      console.error('Error fetching employee:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getEmployeeById:', error);
    return null;
  }
}

export async function createEmployee(tenantId: string, input: CreateEmployeeInput) {
  try {
    await validateTenantAccess(tenantId);

    const validatedInput = createEmployeeSchema.parse(input);
    const supabase = await createClient();

    // Check if employee code already exists
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('employee_code', validatedInput.employeeCode)
      .single();

    if (existing) {
      return {
        success: false,
        error: 'Employee code already exists',
      };
    }

    const { data, error } = await supabase
      .from('employees')
      .insert({
        tenant_id: tenantId,
        employee_code: validatedInput.employeeCode,
        first_name: validatedInput.firstName,
        last_name: validatedInput.lastName,
        email: validatedInput.email || null,
        phone: validatedInput.phone || null,
        position: validatedInput.position || null,
        hire_date: validatedInput.hireDate || null,
        department_id: validatedInput.departmentId || null,
        status: validatedInput.status,
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      employee: data,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

export async function updateEmployee(tenantId: string, employeeId: string, input: UpdateEmployeeInput) {
  try {
    await validateTenantAccess(tenantId);

    const validatedInput = updateEmployeeSchema.parse(input);
    const supabase = await createClient();

    // Check if employee code is being changed and already exists
    const currentEmployee = await getEmployeeById(tenantId, employeeId);
    if (currentEmployee && currentEmployee.employee_code !== validatedInput.employeeCode) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('employee_code', validatedInput.employeeCode)
        .neq('id', employeeId)
        .single();

      if (existing) {
        return {
          success: false,
          error: 'Employee code already exists',
        };
      }
    }

    const { data, error } = await supabase
      .from('employees')
      .update({
        employee_code: validatedInput.employeeCode,
        first_name: validatedInput.firstName,
        last_name: validatedInput.lastName,
        email: validatedInput.email || null,
        phone: validatedInput.phone || null,
        position: validatedInput.position || null,
        hire_date: validatedInput.hireDate || null,
        department_id: validatedInput.departmentId || null,
        status: validatedInput.status,
      })
      .eq('id', employeeId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      employee: data,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

export async function deleteEmployee(tenantId: string, employeeId: string) {
  try {
    await validateTenantAccess(tenantId);

    const supabase = await createClient();

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId)
      .eq('tenant_id', tenantId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Employee deleted successfully',
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
