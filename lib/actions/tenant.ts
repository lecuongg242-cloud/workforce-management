'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { createTenantSchema, type CreateTenantInput } from '@/lib/validations';
import type { UserTenant } from '@/types';

export async function createTenant(input: CreateTenantInput) {
  try {
    const validatedInput = createTenantSchema.parse(input);
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const supabase = await createClient();

    // Call RPC function to create tenant with owner assignment
    const { data, error } = await supabase.rpc('create_tenant_with_owner', {
      p_tenant_name: validatedInput.name,
      p_tenant_slug: validatedInput.slug,
      p_tenant_description: validatedInput.description || null,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (data && data[0] && !data[0].success) {
      return {
        success: false,
        error: data[0].error_message,
      };
    }

    return {
      success: true,
      tenantId: data?.[0]?.tenant_id,
      message: 'Tenant created successfully',
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

export async function getUserTenants(): Promise<UserTenant[]> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return [];
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_user_tenants');

    if (error) {
      console.error('Error fetching tenants:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserTenants:', error);
    return [];
  }
}

export async function getTenantById(tenantId: string) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return null;
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.error('Error fetching tenant:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getTenantById:', error);
    return null;
  }
}

export async function getUserRoleInTenant(tenantId: string) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return null;
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_user_role_in_tenant', {
      p_tenant_id: tenantId,
    });

    if (error) {
      console.error('Error fetching user role:', error);
      return null;
    }

    if (data && data[0] && data[0].is_member) {
      return data[0].role;
    }

    return null;
  } catch (error) {
    console.error('Error in getUserRoleInTenant:', error);
    return null;
  }
}
