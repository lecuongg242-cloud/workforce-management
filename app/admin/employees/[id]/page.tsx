'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import AdminTopbar from '@/components/shared/AdminTopbar'
import EmployeeAvatar from '@/components/shared/EmployeeAvatar'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mockEmployees, mockDepartments, mockShifts, mockAttendanceRecords } from '@/lib/mock-data'
import { formatDate, getStatusLabel } from '@/lib/utils'
import { Mail, Phone, MapPin, Calendar, Edit2, MoreVertical } from 'lucide-react'

export default function EmployeeDetailPage() {
  const params = useParams()
  const employeeId = params.id as string
  const employee = mockEmployees.find((e) => e.id === employeeId)
  const department = mockDepartments.find((d) => d.id === employee?.departmentId)
  const shift = mockShifts.find((s) => s.id === employee?.defaultShiftId)
  const [activeTab, setActiveTab] = useState('overview')

  if (!employee) {
    return (
      <div className="flex flex-col flex-1">
        <AdminTopbar title="Không tìm thấy" />
        <div className="flex items-center justify-center flex-1">
          <p className="text-body-lg text-ink-muted">Nhân viên không tồn tại</p>
        </div>
      </div>
    )
  }

  const monthRecords = mockAttendanceRecords.filter(
    (r) => r.employeeId === employeeId
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <AdminTopbar
        title={employee.fullName}
        actions={
          <div className="flex gap-2">
            <Button className="pill-button-secondary gap-2 hidden sm:flex" size="md">
              <Edit2 className="h-4 w-4" />
              Chỉnh sửa
            </Button>
            <Button className="pill-button-ghost p-2" size="md">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-6">
                <EmployeeAvatar name={employee.fullName} size="lg" />
                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-display-md font-light text-ink mb-2">
                      {employee.fullName}
                    </h1>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={employee.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-caption text-ink-muted uppercase">Mã nhân viên</p>
                      <p className="text-body-lg text-ink">{employee.employeeCode}</p>
                    </div>
                    <div>
                      <p className="text-caption text-ink-muted uppercase">Chức vụ</p>
                      <p className="text-body-lg text-ink">{employee.position}</p>
                    </div>
                    <div>
                      <p className="text-caption text-ink-muted uppercase">Phòng ban</p>
                      <p className="text-body-lg text-ink">{department?.name}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="border-b border-border flex gap-6">
            {['overview', 'attendance', 'schedule', 'requests', 'salary'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-body-md font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {tab === 'overview' && 'Tổng quan'}
                {tab === 'attendance' && 'Chấm công'}
                {tab === 'schedule' && 'Lịch làm việc'}
                {tab === 'requests' && 'Yêu cầu'}
                {tab === 'salary' && 'Thông tin lương'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin liên hệ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-caption text-ink-muted">Email</p>
                      <p className="text-body-md text-ink">{employee.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-caption text-ink-muted">Số điện thoại</p>
                      <p className="text-body-md text-ink">{employee.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-caption text-ink-muted">Địa điểm làm việc</p>
                      <p className="text-body-md text-ink">{employee.workLocation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Work Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin công việc</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-caption text-ink-muted uppercase mb-2">Loại hợp đồng</p>
                    <p className="text-body-lg text-ink">{getStatusLabel(employee.contractType)}</p>
                  </div>
                  <div>
                    <p className="text-caption text-ink-muted uppercase mb-2">Ngày bắt đầu</p>
                    <p className="text-body-lg text-ink">{formatDate(employee.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-caption text-ink-muted uppercase mb-2">Ca làm mặc định</p>
                    <p className="text-body-lg text-ink">{shift?.name}</p>
                  </div>
                  <div>
                    <p className="text-caption text-ink-muted uppercase mb-2">Vai trò hệ thống</p>
                    <p className="text-body-lg text-ink">{getStatusLabel(employee.systemRole)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Current Month Attendance */}
              <Card>
                <CardHeader>
                  <CardTitle>Chấm công tháng này</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthRecords.length > 0 ? (
                    <div className="space-y-2">
                      {monthRecords.map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-canvas-soft"
                        >
                          <span className="text-body-md text-ink-muted">{formatDate(record.date)}</span>
                          <StatusBadge status={record.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-body-md text-ink-muted">Không có dữ liệu chấm công</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'salary' && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-body-lg text-ink-muted">
                  Thông tin lương sẽ được thiết lập trong giai đoạn tiếp theo.
                </p>
              </CardContent>
            </Card>
          )}

          {['attendance', 'schedule', 'requests'].includes(activeTab) && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-body-lg text-ink-muted">Nội dung đang được phát triển</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
