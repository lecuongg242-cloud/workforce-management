'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import AppLogo from '@/components/shared/AppLogo'
import EmployeeAvatar from '@/components/shared/EmployeeAvatar'
import { mockCompanies } from '@/lib/mock-data'
import { formatDate } from '@/lib/utils'
import { Plus } from 'lucide-react'

export default function SelectCompanyPage() {
  const router = useRouter()

  const handleSelectCompany = (companyId: string) => {
    router.push('/admin/dashboard')
  }

  const handleCreateCompany = () => {
    router.push('/onboarding')
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <AppLogo size="md" />
          <button
            onClick={() => router.push('/login')}
            className="text-body-md text-ink-muted hover:text-ink font-medium"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-display-lg font-light text-ink mb-2">
            Chọn doanh nghiệp
          </h1>
          <p className="text-body-lg text-ink-muted">
            Chọn một doanh nghiệp để tiếp tục
          </p>
        </div>

        {/* Company Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockCompanies.map((company) => (
            <div
              key={company.id}
              className="card-feature cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleSelectCompany(company.id)}
            >
              <div className="flex items-start gap-4 mb-6">
                <EmployeeAvatar name={company.name} size="lg" />
                <div className="flex-1">
                  <h3 className="text-heading-md font-light text-ink">
                    {company.name}
                  </h3>
                  <p className="text-body-md text-ink-muted">{company.userRole}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6 pb-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="text-body-md text-ink-muted">
                    Nhân viên
                  </span>
                  <span className="text-heading-md font-light text-ink">
                    {company.employeeCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body-md text-ink-muted">
                    Lần truy cập cuối
                  </span>
                  <span className="text-body-md text-ink">
                    {formatDate(company.lastAccessed)}
                  </span>
                </div>
              </div>

              <Button
                className="w-full pill-button-primary"
                onClick={() => handleSelectCompany(company.id)}
              >
                Truy cập
              </Button>
            </div>
          ))}

          {/* Create New Company Card */}
          <div
            className="card-feature flex flex-col items-center justify-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={handleCreateCompany}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-soft">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-heading-md font-light text-ink text-center">
              Tạo doanh nghiệp mới
            </h3>
            <Button
              className="w-full pill-button-secondary"
              onClick={handleCreateCompany}
            >
              Tạo mới
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
