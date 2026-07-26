'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import type { UserTenant } from '@/types';

interface TenantCardProps {
  tenant: UserTenant;
}

export function TenantCard({ tenant }: TenantCardProps) {
  return (
    <Link href={`/dashboard/${tenant.id}/employees`}>
      <Card className="hover:shadow-stripi-md transition-shadow cursor-pointer h-full border-hairline">
        <CardHeader>
          <div className="flex items-start justify-between gap-md">
            <CardTitle className="line-clamp-1 text-heading-md">{tenant.name}</CardTitle>
            <Badge variant="secondary" className="text-micro-cap font-medium bg-primary-bg-subdued-hover text-primary-deep whitespace-nowrap">
              {tenant.role}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-lg">
          {tenant.description && (
            <p className="text-body-md text-ink-mute line-clamp-2">
              {tenant.description}
            </p>
          )}

          <div className="flex items-center justify-between text-caption text-ink-mute">
            <span>{tenant.slug}</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
