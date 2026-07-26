'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminTopbar from '@/components/shared/AdminTopbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mockDepartments, mockShifts } from '@/lib/mock-data'
import { ArrowLeft } from 'lucide-react'

export default function AddEmployeePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    employeeCode: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'male',
    departmentId: mockDepartments[0]?.id || '',
    position: '',
    contractType: 'full-time',
    startDate: '',
    directManagerId: '',
    defaultShiftId: mockShifts[0]?.id || '',
    workLocation: '',
    allowPayslipView: false,
    allowRemoteCheckIn: false,
    systemRole: 'employee',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      router.push('/admin/employees')
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <AdminTopbar
        title="Thêm nhân viên mới"
        actions={
          <Link href="/admin/employees">
            <Button className="pill-button-ghost gap-2" size="md">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Quay lại</span>
            </Button>
          </Link>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cá nhân</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Họ và tên *</Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeCode">Mã nhân viên *</Label>
                    <Input
                      id="employeeCode"
                      name="employeeCode"
                      value={formData.employeeCode}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Số điện thoại</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Ngày sinh</Label>
                    <Input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Giới tính</Label>
                    <select
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="input-base"
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Work Information */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin công việc</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departmentId">Phòng ban *</Label>
                    <select
                      id="departmentId"
                      name="departmentId"
                      value={formData.departmentId}
                      onChange={handleChange}
                      className="input-base"
                      required
                    >
                      {mockDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Chức vụ *</Label>
                    <Input
                      id="position"
                      name="position"
                      value={formData.position}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contractType">Loại hợp đồng *</Label>
                    <select
                      id="contractType"
                      name="contractType"
                      value={formData.contractType}
                      onChange={handleChange}
                      className="input-base"
                      required
                    >
                      <option value="full-time">Toàn thời gian</option>
                      <option value="part-time">Bán thời gian</option>
                      <option value="contract">Hợp đồng</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Ngày bắt đầu *</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultShiftId">Ca làm mặc định *</Label>
                    <select
                      id="defaultShiftId"
                      name="defaultShiftId"
                      value={formData.defaultShiftId}
                      onChange={handleChange}
                      className="input-base"
                      required
                    >
                      {mockShifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workLocation">Địa điểm làm việc</Label>
                    <Input
                      id="workLocation"
                      name="workLocation"
                      value={formData.workLocation}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Access */}
            <Card>
              <CardHeader>
                <CardTitle>Quyền truy cập</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="allowPayslipView"
                      name="allowPayslipView"
                      checked={formData.allowPayslipView}
                      onChange={handleChange}
                    />
                    <Label htmlFor="allowPayslipView" className="cursor-pointer">
                      Cho phép xem phiếu lương
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="allowRemoteCheckIn"
                      name="allowRemoteCheckIn"
                      checked={formData.allowRemoteCheckIn}
                      onChange={handleChange}
                    />
                    <Label htmlFor="allowRemoteCheckIn" className="cursor-pointer">
                      Cho phép chấm công ngoài địa điểm
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3 justify-end sticky bottom-6 bg-canvas-soft p-4 rounded-lg">
              <Link href="/admin/employees">
                <Button className="pill-button-ghost">Hủy</Button>
              </Link>
              <Button className="pill-button-primary" type="submit" disabled={loading}>
                {loading ? 'Đang lưu...' : 'Thêm nhân viên'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
