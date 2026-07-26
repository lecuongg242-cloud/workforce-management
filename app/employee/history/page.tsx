'use client'

import React, { useState } from 'react'
import AppLogo from '@/components/shared/AppLogo'
import StatusBadge from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/card'
import { mockAttendanceRecords } from '@/lib/mock-data'
import { formatDate, calculateWorkHours } from '@/lib/utils'
import { Clock, LogOut, MapPin } from 'lucide-react'

export default function EmployeeHistoryPage() {
  const [month, setMonth] = useState('2026-07')

  const filteredRecords = mockAttendanceRecords
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date))

  const monthSummary = {
    workDays: filteredRecords.filter((r) => r.checkInTime).length,
    totalHours: filteredRecords
      .filter((r) => r.checkInTime && r.checkOutTime)
      .reduce((acc, r) => {
        const hours = parseInt(calculateWorkHours(r.checkInTime!, r.checkOutTime!, 90).match(/\d+/)?.[0] || '0')
        return acc + hours
      }, 0),
    lateCount: filteredRecords.filter((r) => r.status === 'late').length,
    leaveCount: filteredRecords.filter((r) => r.status === 'leave').length,
  }

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-border">
        <div className="px-4 py-4">
          <AppLogo size="sm" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-display-md font-light text-ink">Lịch sử chấm công</h1>
          <p className="text-body-md text-ink-muted mt-1">Xem lịch sử chấm công của bạn</p>
        </div>

        {/* Month Selector */}
        <div className="flex gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input-base flex-1"
          />
        </div>

        {/* Monthly Summary */}
        <Card className="p-4 space-y-3">
          <h3 className="text-heading-sm font-light text-ink">Tóm tắt tháng</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-caption text-ink-muted mb-1">Ngày công</p>
              <p className="text-display-md font-light text-ink">{monthSummary.workDays}</p>
            </div>
            <div>
              <p className="text-caption text-ink-muted mb-1">Tổng giờ</p>
              <p className="text-display-md font-light text-ink">{monthSummary.totalHours}h</p>
            </div>
            <div>
              <p className="text-caption text-ink-muted mb-1">Đi muộn</p>
              <p className="text-display-md font-light text-ruby">{monthSummary.lateCount}</p>
            </div>
            <div>
              <p className="text-caption text-ink-muted mb-1">Nghỉ phép</p>
              <p className="text-display-md font-light text-primary">
                {monthSummary.leaveCount}
              </p>
            </div>
          </div>
        </Card>

        {/* Attendance Records */}
        <div className="space-y-3">
          <h3 className="text-heading-sm font-light text-ink px-2">Chấm công</h3>
          {filteredRecords.length > 0 ? (
            <div className="space-y-3">
              {filteredRecords.map((record) => (
                <Card key={record.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-body-md font-medium text-ink">
                      {formatDate(record.date)}
                    </span>
                    <StatusBadge status={record.status} />
                  </div>
                  <div className="space-y-2 text-body-md">
                    {record.checkInTime && (
                      <div className="flex items-center gap-3 text-ink-secondary">
                        <Clock className="h-4 w-4" />
                        <span>Vào: {record.checkInTime}</span>
                      </div>
                    )}
                    {record.checkOutTime && (
                      <div className="flex items-center gap-3 text-ink-secondary">
                        <LogOut className="h-4 w-4" />
                        <span>Ra: {record.checkOutTime}</span>
                      </div>
                    )}
                    {record.location && (
                      <div className="flex items-center gap-3 text-ink-secondary text-caption">
                        <MapPin className="h-4 w-4" />
                        <span>{record.location}</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-body-md text-ink-muted">
                Không có dữ liệu chấm công cho tháng này
              </p>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
