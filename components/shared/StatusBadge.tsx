import React from 'react'
import { getStatusBadgeClass, getStatusLabel } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  label?: string
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${getStatusBadgeClass(status)}`}>
      {label || getStatusLabel(status)}
    </span>
  )
}
