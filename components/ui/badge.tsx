import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-pill border px-sm py-xs text-micro-cap font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-on-primary hover:bg-primary-deep',
        secondary: 'border-primary-bg-subdued-hover bg-primary-bg-subdued-hover text-primary-deep hover:bg-opacity-80',
        destructive: 'border-transparent bg-ruby text-on-primary hover:bg-ruby/90',
        outline: 'text-ink border-hairline',
        'status-active': 'border-transparent bg-emerald-100 text-emerald-700',
        'status-inactive': 'border-transparent bg-zinc-100 text-zinc-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
