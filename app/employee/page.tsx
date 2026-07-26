'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import AppLogo from '@/components/shared/AppLogo'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { mockShifts, mockAttendanceRecords } from '@/lib/mock-data'
import { Calendar, Clock, MapPin, LogOut, Menu, LogIn, CheckCircle2 } from 'lucide-react'
import { getDayOfWeek, formatDate } from '@/lib/utils'

export default function EmployeeHomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [checkInState, setCheckInState] = useState<'before' | 'during' | 'after'>('before')
  const [checkInTime, setCheckInTime] = useState('')
  const [checkOutTime, setCheckOutTime] = useState('')

  const today = new Date()
  const dayOfWeek = getDayOfWeek('2026-07-27')
  const shift = mockShifts[0]

  const handleCheckIn = () => {
    const now = new Date()
    setCheckInTime(now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0'))
    setCheckInState('during')
  }

  const handleCheckOut = () => {
    const now = new Date()
    setCheckOutTime(now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0'))
    setCheckInState('after')
  }

  const handleReset = () => {
    setCheckInState('before')
    setCheckInTime('')
    setCheckOutTime('')
  }

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-border md:hidden">
        <div className="px-4 py-4 flex items-center justify-between">
          <AppLogo size="sm" />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-canvas-soft rounded"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border p-4 space-y-2">
            <button className="w-full text-left px-4 py-2 text-body-md text-ink hover:bg-canvas-soft rounded">
              Hồ sơ
            </button>
            <button className="w-full text-left px-4 py-2 text-body-md text-ink hover:bg-canvas-soft rounded flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-display-md font-light text-ink">
            Chào buổi sáng, Minh
          </h1>
          <p className="text-body-md text-ink-muted mt-1">
            Hôm nay, {dayOfWeek} 27/07/2026
          </p>
        </div>

        {/* Current Shift */}
        {shift && (
          <Card className="p-4">
            <div className="space-y-3">
              <div>
                <p className="text-caption text-ink-muted uppercase mb-1">Ca hôm nay</p>
                <h2 className="text-heading-md font-light text-ink">{shift.name}</h2>
              </div>
              <div className="flex items-center gap-2 text-body-md text-ink-secondary">
                <Clock className="h-4 w-4" />
                {shift.startTime}–{shift.endTime}
              </div>
              <div className="flex items-center gap-2 text-body-md text-ink-secondary">
                <MapPin className="h-4 w-4" />
                Văn phòng chính
              </div>
            </div>
          </Card>
        )}

        {/* Attendance Card */}
        <Card className="p-6 space-y-6">
          {/* Status Display */}
          <div className="text-center space-y-2">
            {checkInState === 'before' && (
              <>
                <div className="text-body-lg text-ink-muted">Chưa vào ca</div>
              </>
            )}
            {checkInState === 'during' && (
              <>
                <div className="space-y-1">
                  <div className="text-body-md text-ink-muted">Giờ vào</div>
                  <div className="text-display-md font-light text-ink">{checkInTime}</div>
                </div>
                <div className="pt-2">
                  <StatusBadge status="on-time" />
                </div>
              </>
            )}
            {checkInState === 'after' && (
              <>
                <div className="space-y-2">
                  <div>
                    <div className="text-caption text-ink-muted">Vào ca</div>
                    <div className="text-heading-md font-light text-ink">{checkInTime}</div>
                  </div>
                  <div>
                    <div className="text-caption text-ink-muted">Tan ca</div>
                    <div className="text-heading-md font-light text-ink">{checkOutTime}</div>
                  </div>
                </div>
                <div className="flex gap-1 justify-center">
                  <StatusBadge status="on-time" />
                </div>
              </>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={
              checkInState === 'before'
                ? handleCheckIn
                : checkInState === 'during'
                  ? handleCheckOut
                  : handleReset
            }
            className="w-full h-16 rounded-full bg-primary text-white font-medium text-heading-sm hover:bg-primary-deep active:bg-primary-pressed transition-colors flex items-center justify-center gap-2"
          >
            {checkInState === 'before' && (
              <>
                <LogIn className="h-5 w-5" />
                Vào ca
              </>
            )}
            {checkInState === 'during' && (
              <>
                <LogOut className="h-5 w-5" />
                Tan ca
              </>
            )}
            {checkInState === 'after' && (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Bắt đầu lại
              </>
            )}
          </button>

          {/* GPS Note */}
          {checkInState === 'before' && (
            <p className="text-center text-caption text-ink-muted">
              📍 Cần bật GPS để chấm công
            </p>
          )}
        </Card>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-heading-sm font-light text-ink px-2">Hành động nhanh</h3>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-sm transition-shadow">
              <Calendar className="h-6 w-6 text-primary mb-2" />
              <span className="text-caption text-ink">Xin nghỉ</span>
            </Card>
            <Card className="p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-sm transition-shadow">
              <Clock className="h-6 w-6 text-primary mb-2" />
              <span className="text-caption text-ink">Bổ sung công</span>
            </Card>
            <Card className="p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-sm transition-shadow">
              <Calendar className="h-6 w-6 text-primary mb-2" />
              <span className="text-caption text-ink">Lịch làm việc</span>
            </Card>
          </div>
        </div>

        {/* Monthly Summary */}
        <Card className="p-4 space-y-3">
          <h3 className="text-heading-sm font-light text-ink">Tóm tắt tháng này</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-caption text-ink-muted mb-1">Ngày công</p>
              <p className="text-display-md font-light text-ink">20</p>
            </div>
            <div>
              <p className="text-caption text-ink-muted mb-1">Tổng giờ</p>
              <p className="text-display-md font-light text-ink">160h</p>
            </div>
            <div>
              <p className="text-caption text-ink-muted mb-1">Đi muộn</p>
              <p className="text-display-md font-light text-ruby">2</p>
            </div>
            <div>
              <p className="text-caption text-ink-muted mb-1">Nghỉ phép</p>
              <p className="text-display-md font-light text-primary">1</p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
}
