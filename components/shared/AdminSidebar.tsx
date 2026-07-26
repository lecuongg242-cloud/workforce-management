'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AppLogo from './AppLogo'
import {
  BarChart3,
  Users,
  Building2,
  Clock,
  LogOut,
  Settings,
  FileText,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  isComingSoon?: boolean
}

const navItems: NavItem[] = [
  { label: 'Tổng quan', href: '/admin/dashboard', icon: <BarChart3 className="h-5 w-5" /> },
  { label: 'Nhân viên', href: '/admin/employees', icon: <Users className="h-5 w-5" /> },
  { label: 'Phòng ban', href: '/admin/departments', icon: <Building2 className="h-5 w-5" /> },
  { label: 'Ca làm việc', href: '/admin/shifts', icon: <Clock className="h-5 w-5" /> },
  { label: 'Chấm công', href: '#', icon: <FileText className="h-5 w-5" />, isComingSoon: true },
  { label: 'Bảng lương', href: '#', icon: <FileText className="h-5 w-5" />, isComingSoon: true },
  { label: 'Cài đặt', href: '#', icon: <Settings className="h-5 w-5" /> },
]

interface AdminSidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function AdminSidebar({ isOpen = true, onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(isOpen)

  const handleClose = () => {
    setMobileOpen(false)
    onClose?.()
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed bottom-6 right-6 z-40 lg:hidden h-12 w-12 rounded-full bg-primary text-white flex items-center justify-center shadow-md"
      >
        {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={handleClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-screen w-64 bg-brand-dark flex flex-col z-30 transition-transform duration-300 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="border-b border-brand-dark/50 p-6">
          <AppLogo className="text-white" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin/dashboard' &&
                  pathname.startsWith(item.href))

              return (
                <div key={item.href}>
                  <Link
                    href={item.isComingSoon ? '#' : item.href}
                    onClick={(e) => {
                      if (item.isComingSoon) e.preventDefault()
                      handleClose()
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-4 py-3 text-body-md font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10',
                      item.isComingSoon && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.isComingSoon && (
                      <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded">
                        Sắp
                      </span>
                    )}
                  </Link>
                </div>
              )
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-brand-dark/50 p-4 space-y-2">
          <button className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-body-md font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            <LogOut className="h-5 w-5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  )
}
