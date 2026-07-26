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
    <div className="p-xl space-y-xl">
      <div className="flex flex-col gap-sm">
        <h1 className="text-display-lg font-light text-ink">Dashboard</h1>
        <p className="text-body-md text-ink-mute">Manage your organizations and team</p>
      </div>

      {tenants.length === 0 ? (
        <Card className="border-hairline">
          <CardHeader>
            <CardTitle className="text-heading-lg">Welcome!</CardTitle>
            <CardDescription className="text-body-md">
              Create your first organization to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTenantDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-lg font-light text-ink">Your Organizations</h2>
            <CreateTenantDialog />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {tenants.map((tenant) => (
              <TenantCard key={tenant.id} tenant={tenant} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
