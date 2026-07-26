import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { DashboardNav } from '@/components/dashboard/nav';
import { Sidebar } from '@/components/dashboard/sidebar';

export const metadata = {
  title: 'Dashboard - Workforce Management',
  description: 'Manage your organization and employees',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <DashboardNav />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
