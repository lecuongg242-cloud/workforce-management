'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import AdminTopbar from '@/components/shared/AdminTopbar'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/shared/StatusBadge'
import EmployeeAvatar from '@/components/shared/EmployeeAvatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mockEmployees, mockAttendanceRecords, mockRequests } from '@/lib/mock-data'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  MapPin,
} from 'lucide-react'
import { formatTime } from '@/lib/utils'

const chartData = [
  { day: 'T2', present: 26, late: 2 },
  { day: 'T3', present: 27, late: 1 },
  { day: 'T4', present: 25, late: 3 },
  { day: 'T5', present: 28, late: 0 },
  { day: 'T6', present: 27, late: 1 },
  { day: 'T7', present: 0, late: 0 },
  { day: 'CN', present: 0, late: 0 },
]

export default function DashboardPage() {
  const today = new Date()
  const dayOfWeek = today.toLocaleDateString('vi-VN', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('vi-VN')

  const todayRecords = mockAttendanceRecords.filter(
    (r) => r.date === '2026-07-27'
  )

  const presentCount = todayRecords.filter(
    (r) => r.checkInTime && !['absence'].includes(r.status)
  ).length

  const lateCount = todayRecords.filter((r) => r.status === 'late').length
  const onLeaveCount = todayRecords.filter((r) => r.status === 'leave').length

  const pendingRequests = mockRequests.filter((r) => r.status === 'pending')

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <AdminTopbar
        title="Tổng quan"
        actions={
          <Link href="/admin/employees/new">
            <Button className="pill-button-primary gap-2" size="md">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Thêm nhân viên</span>
            </Button>
          </Link>
        }
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Greeting */}
          <div>
            <h2 className="text-display-lg font-light text-ink">
              Chào buổi sáng, Nguyễn Văn Quân
            </h2>
            <p className="text-body-lg text-ink-muted mt-1">
              Đây là tình hình nhân sự hôm nay ({dayOfWeek} {dateStr}).
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-body-md text-ink-muted">Tổng nhân viên</span>
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-display-md font-light text-ink">28</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-body-md text-ink-muted">Đã chấm công</span>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-display-md font-light text-ink">{presentCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-body-md text-ink-muted">Đi muộn</span>
                    <AlertCircle className="h-5 w-5 text-ruby" />
                  </div>
                  <div>
                    <p className="text-display-md font-light text-ink">{lateCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-body-md text-ink-muted">Đang nghỉ</span>
                    <Clock className="h-5 w-5 text-primary-soft" />
                  </div>
                  <div>
                    <p className="text-display-md font-light text-ink">{onLeaveCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Attendance Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Chấm công 7 ngày</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ee" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="present" fill="#533afd" name="Đúng giờ" />
                    <Bar dataKey="late" fill="#ea2261" name="Đi muộn" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pending Requests */}
            <Card>
              <CardHeader>
                <CardTitle>Yêu cầu chờ duyệt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingRequests.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-3xl font-light text-primary">
                        {pendingRequests.length}
                      </div>
                      <div className="text-body-md text-ink-muted">
                        yêu cầu cần duyệt
                      </div>
                      <Link href="/admin/employees">
                        <Button className="w-full pill-button-secondary mt-4" size="sm">
                          Xem tất cả
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="text-body-md text-ink-muted py-4 text-center">
                      Không có yêu cầu chờ duyệt
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Today's Attendance */}
          <Card>
            <CardHeader>
              <CardTitle>Chấm công hôm nay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-body-md">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-4 text-ink-muted font-medium">
                        Nhân viên
                      </th>
                      <th className="text-left py-3 px-4 text-ink-muted font-medium">
                        Phòng ban
                      </th>
                      <th className="text-left py-3 px-4 text-ink-muted font-medium">
                        Giờ vào
                      </th>
                      <th className="text-left py-3 px-4 text-ink-muted font-medium">
                        Trạng thái
                      </th>
                      <th className="text-left py-3 px-4 text-ink-muted font-medium">
                        Địa điểm
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayRecords.slice(0, 5).map((record) => {
                      const employee = mockEmployees.find(
                        (e) => e.id === record.employeeId
                      )
                      return (
                        <tr
                          key={record.id}
                          className="border-b border-border hover:bg-canvas-soft"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <EmployeeAvatar name={employee?.fullName || ''} size="sm" />
                              {employee?.fullName}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-ink-muted">
                            {employee?.departmentId}
                          </td>
                          <td className="py-3 px-4">
                            {record.checkInTime ? formatTime(record.checkInTime) : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={record.status} />
                          </td>
                          <td className="py-3 px-4 text-ink-muted">
                            {record.location}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
