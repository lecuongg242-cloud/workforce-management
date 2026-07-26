import React from 'react'
import AdminSidebar from '@/components/shared/AdminSidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden w-full">
        {children}
      </div>
    </div>
  )
}
