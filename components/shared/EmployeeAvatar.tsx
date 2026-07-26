import React from 'react'
import { getInitials } from '@/lib/utils'

interface EmployeeAvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function EmployeeAvatar({
  name,
  size = 'md',
  className = '',
}: EmployeeAvatarProps) {
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-primary text-white font-medium ${sizeClasses[size]} ${className}`}
    >
      {getInitials(name)}
    </div>
  )
}
