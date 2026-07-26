'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    label: 'Employees',
    href: '/dashboard/employees',
    icon: Users,
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 bg-canvas border-r border-hairline flex-col">
      <div className="p-xl">
        <h1 className="text-heading-lg font-light text-ink">Workforce</h1>
      </div>

      <nav className="flex-1 flex flex-col gap-sm px-md">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-lg px-md py-sm rounded-sm transition-colors text-body-md font-medium',
                isActive
                  ? 'bg-primary text-on-primary'
                  : 'text-ink hover:bg-canvas-soft'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
