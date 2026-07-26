'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { getUserRoleInTenant } from '@/lib/actions/tenant';
import { createDepartmentSchema, type CreateDepartmentInput } from '@/lib/validations';
import type { Department } from '@/types';

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

export async function getDepartments(tenantId: string): Promise<Department[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching departments:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getDepartments:', error);
    return [];
  }
}

export async function createDepartment(tenantId: string, input: CreateDepartmentInput) {
  try {
    await validateTenantAccess(tenantId);

    const validatedInput = createDepartmentSchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('departments')
      .insert({
        tenant_id: tenantId,
        name: validatedInput.name,
        description: validatedInput.description || null,
        parent_dept_id: validatedInput.parentDeptId || null,
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
      department: data,
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
