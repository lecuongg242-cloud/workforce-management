import React from 'react'
import MobileBottomNav from '@/components/shared/MobileBottomNav'

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-canvas pb-20 md:pb-0">
      {children}
      <MobileBottomNav />
    </div>
  )
}
