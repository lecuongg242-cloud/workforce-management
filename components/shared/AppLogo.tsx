import React from 'react'
import { cn } from '@/lib/utils'

interface AppLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function AppLogo({ className, size = 'md' }: AppLogoProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <span className="text-sm font-bold text-white">T</span>
      </div>
      <span className={cn('font-light text-ink', sizeClasses[size])}>TimeFlow</span>
    </div>
  )
}
