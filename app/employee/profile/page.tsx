'use client'

import React from 'react'
import Link from 'next/link'
import AppLogo from '@/components/shared/AppLogo'
import EmployeeAvatar from '@/components/shared/EmployeeAvatar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { mockEmployees } from '@/lib/mock-data'
import {
  User,
  Lock,
  Bell,
  HelpCircle,
  LogOut,
  Mail,
  Phone,
  Building2,
  Briefcase,
} from 'lucide-react'

const employee = mockEmployees[0]

const profileMenuItems = [
  {
    icon: User,
    label: 'Thông tin cá nhân',
    href: '#',
    description: 'Xem và chỉnh sửa thông tin cá nhân',
  },
  {
    icon: Lock,
    label: 'Đổi mật khẩu',
    href: '#',
    description: 'Cập nhật mật khẩu của bạn',
  },
  {
    icon: Bell,
    label: 'Cài đặt thông báo',
    href: '#',
    description: 'Quản lý thông báo',
  },
  {
    icon: HelpCircle,
    label: 'Trợ giúp',
    href: '#',
    description: 'Tìm kiếm sự hỗ trợ',
  },
]

export default function EmployeeProfilePage() {
  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-border">
        <div className="px-4 py-4">
          <AppLogo size="sm" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6 pb-20">
        {/* Profile Header */}
        <Card className="p-6 text-center space-y-4">
          <EmployeeAvatar name={employee.fullName} size="lg" className="mx-auto" />
          <div>
            <h1 className="text-heading-lg font-light text-ink">
              {employee.fullName}
            </h1>
            <p className="text-body-md text-ink-muted">{employee.employeeCode}</p>
          </div>
        </Card>

        {/* Work Info */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <Briefcase className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-caption text-ink-muted">Chức vụ</p>
              <p className="text-body-md text-ink">{employee.position}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <Building2 className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-caption text-ink-muted">Phòng ban</p>
              <p className="text-body-md text-ink">{employee.departmentId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <Mail className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-caption text-ink-muted">Email</p>
              <p className="text-body-md text-ink break-all">{employee.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-caption text-ink-muted">Số điện thoại</p>
              <p className="text-body-md text-ink">{employee.phone}</p>
            </div>
          </div>
        </Card>

        {/* Menu Items */}
        <div className="space-y-2">
          {profileMenuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link href={item.href} key={item.label}>
                <Card className="p-4 hover:shadow-sm transition-shadow cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-body-md font-medium text-ink">
                        {item.label}
                      </p>
                      <p className="text-caption text-ink-muted">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Logout Button */}
        <Link href="/login">
          <Button className="w-full pill-button-secondary gap-2 h-12" size="lg">
            <LogOut className="h-5 w-5" />
            Đăng xuất
          </Button>
        </Link>
      </main>
    </div>
  )
}
