import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-slate-950 dark:focus-visible:ring-blue-400',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 rounded-lg dark:bg-blue-700 dark:hover:bg-blue-600 dark:active:bg-blue-800',
        secondary: 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50 rounded-lg dark:bg-slate-800 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-slate-700',
        destructive: 'bg-red-600 text-white hover:bg-red-700 rounded-lg dark:bg-red-700 dark:hover:bg-red-600',
        outline: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 rounded-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700',
        ghost: 'text-slate-900 hover:bg-slate-100 rounded-lg dark:text-slate-50 dark:hover:bg-slate-800',
        link: 'text-blue-600 underline-offset-4 hover:underline h-auto px-0 py-0 dark:text-blue-400',
      },
      size: {
        default: 'h-10 px-4 py-2 text-sm',
        sm: 'h-9 px-3 py-1.5 text-sm',
        lg: 'h-12 px-6 py-2.5 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
