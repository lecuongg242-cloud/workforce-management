'use client'

import React, { useState } from 'react'
import EmployeeAvatar from './EmployeeAvatar'
import { Bell, ChevronDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface AdminTopbarProps {
  title?: string
  actions?: React.ReactNode
}

export default function AdminTopbar({ title, actions }: AdminTopbarProps) {
  const [openNotifications, setOpenNotifications] = useState(false)
  const [openProfile, setOpenProfile] = useState(false)

  return (
    <header className="border-b border-border bg-white sticky top-0 z-20">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        {/* Left: Search or Title */}
        <div className="flex items-center gap-4 flex-1">
          {title && <h1 className="text-heading-md font-light text-ink">{title}</h1>}
        </div>

        {/* Center: Search (hidden on mobile) */}
        <div className="hidden md:flex flex-1 max-w-xs">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <Input
              type="text"
              placeholder="Tìm kiếm..."
              className="pl-9 text-body-md"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {actions}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setOpenNotifications(!openNotifications)
                setOpenProfile(false)
              }}
              className="relative p-2 hover:bg-canvas-soft rounded-lg transition-colors"
              aria-label="Thông báo"
            >
              <Bell className="h-5 w-5 text-ink-muted" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-ruby rounded-full"></span>
            </button>

            {openNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border border-border shadow-md p-4 z-30">
                <h3 className="text-heading-sm font-light mb-3 text-ink">Thông báo</h3>
                <div className="space-y-3">
                  <div className="pb-3 border-b border-border last:border-b-0">
                    <p className="text-body-md text-ink">3 nhân viên đi muộn hôm nay</p>
                    <p className="text-caption text-ink-muted mt-1">10 phút trước</p>
                  </div>
                  <div className="pb-3 border-b border-border last:border-b-0">
                    <p className="text-body-md text-ink">2 yêu cầu chờ duyệt</p>
                    <p className="text-caption text-ink-muted mt-1">1 giờ trước</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => {
                setOpenProfile(!openProfile)
                setOpenNotifications(false)
              }}
              className="flex items-center gap-2 p-2 hover:bg-canvas-soft rounded-lg transition-colors"
            >
              <EmployeeAvatar name="Nguyễn Văn Quân" size="sm" />
              <ChevronDown className="h-4 w-4 text-ink-muted" />
            </button>

            {openProfile && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg border border-border shadow-md z-30">
                <div className="p-4 border-b border-border">
                  <p className="text-body-md font-medium text-ink">Nguyễn Văn Quân</p>
                  <p className="text-caption text-ink-muted">quan@timeflow.com</p>
                </div>
                <button className="w-full text-left px-4 py-3 text-body-md text-ink hover:bg-canvas-soft transition-colors border-b border-border">
                  Hồ sơ
                </button>
                <button className="w-full text-left px-4 py-3 text-body-md text-ink hover:bg-canvas-soft transition-colors">
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
