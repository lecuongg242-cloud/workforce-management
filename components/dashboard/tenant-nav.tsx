'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tenant, TenantRole } from '@/types';

interface TenantNavProps {
  tenant: Tenant;
  userRole: TenantRole;
}

export function TenantNav({ tenant, userRole }: TenantNavProps) {
  const params = useParams();
  const pathname = usePathname();
  const tenantId = params.tenantId as string;

  const navItems = [
    {
      label: 'Employees',
      href: `/dashboard/${tenantId}/employees`,
      icon: Users,
    },
    {
      label: 'Settings',
      href: `/dashboard/${tenantId}/settings`,
      icon: Settings,
    },
  ];

  return (
    <div className="border-b bg-background sticky top-16 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-sm text-foreground/60 hover:text-foreground">
              Organizations
            </Link>
            <span className="text-foreground/40">/</span>
            <span className="font-medium">{tenant.name}</span>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/70 hover:bg-accent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="text-xs bg-muted px-2 py-1 rounded text-foreground/60">
            {userRole}
          </div>
        </div>
      </div>
    </div>
  );
}
