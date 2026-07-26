import { redirect } from 'next/navigation';
import { getTenantById, getUserRoleInTenant } from '@/lib/actions/tenant';
import { getCurrentUser } from '@/lib/actions/auth';
import { TenantNav } from '@/components/dashboard/tenant-nav';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const tenant = await getTenantById(tenantId);
  const userRole = await getUserRoleInTenant(tenantId);

  if (!tenant || !userRole) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-canvas-soft">
      <TenantNav tenant={tenant} userRole={userRole} />
      {children}
    </div>
  );
}
