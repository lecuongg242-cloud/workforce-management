import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-on-primary hover:bg-primary-deep active:bg-primary-press rounded-pill',
        secondary: 'bg-canvas text-primary border border-primary hover:bg-primary hover:text-on-primary rounded-pill',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-ruby/90 rounded-pill',
        outline: 'border border-hairline bg-canvas text-ink hover:bg-canvas-soft rounded-lg',
        ghost: 'text-ink hover:bg-canvas-soft rounded-lg',
        link: 'text-primary underline-offset-4 hover:underline h-auto px-0 py-0',
        'on-dark': 'bg-brand-dark text-on-primary hover:opacity-90 rounded-pill',
      },
      size: {
        default: 'h-10 px-4 py-2 text-button-md',
        sm: 'h-9 px-3 py-1.5 text-button-sm',
        lg: 'h-12 px-6 py-2.5 text-button-md',
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
