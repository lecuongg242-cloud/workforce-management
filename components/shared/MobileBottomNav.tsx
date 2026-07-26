'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Clock, FileText, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Trang chủ', href: '/employee', icon: Home },
  { label: 'Lịch sử', href: '/employee/history', icon: Clock },
  { label: 'Yêu cầu', href: '/employee/requests', icon: FileText },
  { label: 'Cá nhân', href: '/employee/profile', icon: User },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border md:hidden z-40">
      <div className="flex">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-3 gap-1 text-xs font-medium transition-colors border-t-2',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-muted hover:text-ink'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
