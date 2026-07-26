'use client'

import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-deep active:bg-primary-pressed',
        secondary: 'bg-canvas border border-primary text-primary hover:bg-canvas-soft active:bg-canvas-soft',
        ghost: 'text-ink hover:bg-canvas-soft active:bg-canvas-soft',
        danger: 'bg-ruby text-white hover:bg-ruby/90 active:bg-ruby/80',
      },
      size: {
        sm: 'h-8 px-3 text-button-sm',
        md: 'h-10 px-4 text-button-md',
        lg: 'h-12 px-6 text-button-md',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
