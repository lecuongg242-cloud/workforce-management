'use client'

import React, { useState } from 'react'
import AdminTopbar from '@/components/shared/AdminTopbar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { mockShifts } from '@/lib/mock-data'
import { Plus, Edit2, Copy, Power, Moon } from 'lucide-react'

export default function ShiftsPage() {
  const [shifts, setShifts] = useState(mockShifts)

  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

  const getWorkDaysDisplay = (workDays: number[]) => {
    return workDays
      .map((day) => dayNames[day])
      .join(', ')
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <AdminTopbar
        title="Ca làm việc"
        actions={
          <Button className="pill-button-primary gap-2" size="md">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Thêm ca</span>
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-heading-lg font-light text-ink">
              {shifts.length} ca làm việc
            </h2>
            <p className="text-body-md text-ink-muted mt-1">
              Quản lý ca làm việc của công ty
            </p>
          </div>

          {/* Shifts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shifts.map((shift) => (
              <Card key={shift.id} className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-heading-md font-light text-ink">
                          {shift.name}
                        </h3>
                        <p className="text-caption text-ink-muted">{shift.code}</p>
                      </div>
                      {shift.isOvernight && (
                        <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
                          <Moon className="h-3 w-3" />
                          Ca qua đêm
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time Info */}
                  <div className="space-y-2 py-4 border-t border-b border-border">
                    <div className="flex justify-between items-center text-body-md">
                      <span className="text-ink-muted">Giờ làm việc</span>
                      <span className="text-ink font-medium">
                        {shift.startTime}–{shift.endTime}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-body-md">
                      <span className="text-ink-muted">Thời gian nghỉ</span>
                      <span className="text-ink font-medium">{shift.breakDuration} phút</span>
                    </div>
                    <div className="flex justify-between items-center text-body-md">
                      <span className="text-ink-muted">Cho phép đi muộn</span>
                      <span className="text-ink font-medium">{shift.lateAllowance} phút</span>
                    </div>
                    <div className="flex justify-between items-center text-body-md">
                      <span className="text-ink-muted">Ngày làm việc</span>
                      <span className="text-ink font-medium text-sm">
                        {getWorkDaysDisplay(shift.workDays)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-body-md">
                      <span className="text-ink-muted">Số nhân viên</span>
                      <span className="text-ink font-medium">
                        {shift.assignedEmployeeCount}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button className="flex-1 pill-button-secondary gap-2" size="sm">
                      <Edit2 className="h-4 w-4" />
                      Sửa
                    </Button>
                    <button className="p-2 hover:bg-canvas-soft rounded transition-colors">
                      <Copy className="h-4 w-4 text-ink-muted" title="Sao chép" />
                    </button>
                    <button className="p-2 hover:bg-canvas-soft rounded transition-colors">
                      <Power className="h-4 w-4 text-ruby" title="Vô hiệu hóa" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
