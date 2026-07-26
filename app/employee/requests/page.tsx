'use client'

import React, { useState } from 'react'
import AppLogo from '@/components/shared/AppLogo'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { mockRequests } from '@/lib/mock-data'
import { formatDate, getStatusLabel } from '@/lib/utils'
import { Plus, Calendar, Clock, Edit2 } from 'lucide-react'

const requestTypeIcons: Record<string, React.ReactNode> = {
  leave: <Calendar className="h-4 w-4" />,
  'attendance-correction': <Clock className="h-4 w-4" />,
  'time-adjustment': <Clock className="h-4 w-4" />,
  'overtime-registration': <Clock className="h-4 w-4" />,
}

const requestTypeLabels: Record<string, string> = {
  leave: 'Xin nghỉ phép',
  'attendance-correction': 'Bổ sung chấm công',
  'time-adjustment': 'Điều chỉnh giờ vào/ra',
  'overtime-registration': 'Đăng ký tăng ca',
}

export default function EmployeeRequestsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>(
    'all'
  )
  const [showNewRequestForm, setShowNewRequestForm] = useState(false)

  const filteredRequests = mockRequests.filter((r) => {
    if (activeTab === 'all') return true
    return r.status === activeTab
  })

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-border">
        <div className="px-4 py-4">
          <AppLogo size="sm" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6 pb-24">
        {/* Title */}
        <div>
          <h1 className="text-display-md font-light text-ink">Yêu cầu</h1>
          <p className="text-body-md text-ink-muted mt-1">
            Quản lý yêu cầu nghỉ phép và bổ sung công
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border -mx-4 px-4">
          {['all', 'pending', 'approved', 'rejected'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`whitespace-nowrap text-body-md font-medium pb-2 border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-muted'
              }`}
            >
              {tab === 'all' && 'Tất cả'}
              {tab === 'pending' && 'Chờ duyệt'}
              {tab === 'approved' && 'Đã duyệt'}
              {tab === 'rejected' && 'Từ chối'}
            </button>
          ))}
        </div>

        {/* Requests List */}
        <div className="space-y-3">
          {filteredRequests.length > 0 ? (
            filteredRequests.map((request) => (
              <Card key={request.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 flex items-start gap-2">
                    {requestTypeIcons[request.type]}
                    <div className="flex-1">
                      <h3 className="text-body-md font-medium text-ink">
                        {requestTypeLabels[request.type]}
                      </h3>
                      <p className="text-caption text-ink-muted mt-1">
                        {formatDate(request.startDate)}
                        {request.endDate && ` - ${formatDate(request.endDate)}`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={request.status} />
                </div>

                <p className="text-body-md text-ink-secondary">{request.reason}</p>

                {request.approverNote && (
                  <div className="bg-canvas-soft p-3 rounded-lg">
                    <p className="text-caption text-ink-muted mb-1">Ghi chú</p>
                    <p className="text-body-md text-ink">{request.approverNote}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {request.status === 'pending' && (
                    <>
                      <Button className="flex-1 pill-button-secondary gap-2" size="sm">
                        <Edit2 className="h-4 w-4" />
                        Chỉnh sửa
                      </Button>
                      <Button className="flex-1 pill-button-ghost" size="sm">
                        Hủy
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-6 text-center">
              <p className="text-body-md text-ink-muted">Không có yêu cầu nào</p>
            </Card>
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowNewRequestForm(true)}
        className="fixed bottom-24 md:bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary-deep active:bg-primary-pressed transition-colors"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* New Request Form (Placeholder) */}
      {showNewRequestForm && (
        <div className="fixed inset-0 bg-black/20 flex items-end z-50">
          <div className="w-full bg-white rounded-t-lg p-6 max-h-96 overflow-y-auto">
            <h2 className="text-heading-md font-light text-ink mb-4">Tạo yêu cầu mới</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-body-md font-medium text-ink block mb-2">
                  Loại yêu cầu
                </label>
                <select className="input-base w-full">
                  <option>Xin nghỉ phép</option>
                  <option>Bổ sung chấm công</option>
                  <option>Điều chỉnh giờ vào/ra</option>
                  <option>Đăng ký tăng ca</option>
                </select>
              </div>
              <div>
                <label className="text-body-md font-medium text-ink block mb-2">
                  Ngày bắt đầu
                </label>
                <input type="date" className="input-base w-full" />
              </div>
              <div>
                <label className="text-body-md font-medium text-ink block mb-2">
                  Lý do
                </label>
                <textarea
                  className="input-base w-full resize-none"
                  rows={3}
                  placeholder="Nhập lý do của bạn"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 pill-button-ghost"
                onClick={() => setShowNewRequestForm(false)}
              >
                Hủy
              </Button>
              <Button className="flex-1 pill-button-primary">Gửi yêu cầu</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
