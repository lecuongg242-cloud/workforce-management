import { redirect } from 'next/navigation';
import { getUserTenants } from '@/lib/actions/tenant';
import { CreateTenantDialog } from '@/components/dashboard/create-tenant-dialog';
import { TenantCard } from '@/components/dashboard/tenant-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const tenants = await getUserTenants();

  if (tenants.length === 1) {
    redirect(`/dashboard/${tenants[0].id}/employees`);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-foreground/60">Manage your organizations and team</p>
      </div>

      {tenants.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Welcome!</CardTitle>
            <CardDescription>
              Create your first organization to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTenantDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Organizations</h2>
            <CreateTenantDialog />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => (
              <TenantCard key={tenant.id} tenant={tenant} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
