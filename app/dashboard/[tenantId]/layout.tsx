import { redirect } from 'next/navigation';
import { getTenantById, getUserRoleInTenant } from '@/lib/actions/tenant';
import { getCurrentUser } from '@/lib/actions/auth';
import { TenantNav } from '@/components/dashboard/tenant-nav';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tenantId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const tenant = await getTenantById(params.tenantId);
  const userRole = await getUserRoleInTenant(params.tenantId);

  if (!tenant || !userRole) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      <TenantNav tenant={tenant} userRole={userRole} />
      {children}
    </div>
  );
}
