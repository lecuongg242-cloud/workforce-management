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
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="line-clamp-1">{tenant.name}</CardTitle>
            <Badge variant="secondary">{tenant.role}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tenant.description && (
            <p className="text-sm text-foreground/60 line-clamp-2">
              {tenant.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-foreground/40">
            <span>{tenant.slug}</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
