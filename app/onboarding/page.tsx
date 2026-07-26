'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLogo from '@/components/shared/AppLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { mockShifts } from '@/lib/mock-data'
import { ArrowRight, ArrowLeft, Check } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    // Step 1
    companyName: '',
    companyCode: '',
    industry: '',
    employeeScale: '11-30',
    phone: '',
    address: '',
    // Step 2
    shiftName: '',
    startTime: '08:00',
    endTime: '17:30',
    breakDuration: '90',
    lateAllowance: '5',
    workDays: [1, 2, 3, 4, 5],
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleToggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter((d) => d !== day)
        : [...prev.workDays, day].sort(),
    }))
  }

  const handleNext = async () => {
    if (step === 2) {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setStep(3)
      setLoading(false)
    } else if (step === 3) {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      router.push('/select-company')
    } else {
      setStep(2)
    }
  }

  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <Link href="/login">
          <AppLogo size="md" />
        </Link>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          {/* Progress */}
          <div>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    s <= step ? 'bg-primary' : 'bg-border'
                  }`}
                />
              ))}
            </div>
            <p className="text-caption text-ink-muted">
              Bước {step} / 3
            </p>
          </div>

          {/* Step 1: Company Information */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-display-lg font-light text-ink">
                  Thông tin doanh nghiệp
                </h2>
                <p className="text-body-lg text-ink-muted mt-2">
                  Hãy cho chúng tôi biết về công ty của bạn
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tên doanh nghiệp *</Label>
                  <Input
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    placeholder="VD: Công ty ABC"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mã doanh nghiệp *</Label>
                  <Input
                    name="companyCode"
                    value={formData.companyCode}
                    onChange={handleChange}
                    placeholder="VD: ABC123"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lĩnh vực</Label>
                  <select
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    className="input-base"
                  >
                    <option value="">Chọn lĩnh vực</option>
                    <option>Công nghệ</option>
                    <option>Bán lẻ</option>
                    <option>Sản xuất</option>
                    <option>Dịch vụ</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Quy mô nhân sự</Label>
                  <select
                    name="employeeScale"
                    value={formData.employeeScale}
                    onChange={handleChange}
                    className="input-base"
                  >
                    <option value="1-10">1–10</option>
                    <option value="11-30">11–30</option>
                    <option value="31-100">31–100</option>
                    <option value="101-500">101–500</option>
                    <option value="500+">Trên 500</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Số điện thoại</Label>
                  <Input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(28) 1234-5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Địa chỉ</Label>
                  <Input
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="VD: 123 Nguyễn Huệ, Q.1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Default Shift */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-display-lg font-light text-ink">
                  Ca làm việc mặc định
                </h2>
                <p className="text-body-lg text-ink-muted mt-2">
                  Thiết lập ca làm việc chung cho nhân viên
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tên ca *</Label>
                  <Input
                    name="shiftName"
                    value={formData.shiftName}
                    onChange={handleChange}
                    placeholder="VD: Ca hành chính"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Giờ bắt đầu</Label>
                  <Input
                    name="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Giờ kết thúc</Label>
                  <Input
                    name="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Thời gian nghỉ (phút)</Label>
                  <Input
                    name="breakDuration"
                    type="number"
                    value={formData.breakDuration}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Cho phép đi muộn (phút)</Label>
                  <Input
                    name="lateAllowance"
                    type="number"
                    value={formData.lateAllowance}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Ngày làm việc</Label>
                <div className="grid grid-cols-4 gap-2">
                  {dayNames.map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleToggleDay(idx)}
                      className={`p-3 rounded-lg border-2 font-medium text-center transition-colors ${
                        formData.workDays.includes(idx)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-ink-muted hover:border-primary'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-display-lg font-light text-ink">
                  Xác nhận cài đặt
                </h2>
                <p className="text-body-lg text-ink-muted mt-2">
                  Kiểm tra lại thông tin trước khi hoàn thành
                </p>
              </div>

              <Card className="p-6 space-y-4">
                <div>
                  <p className="text-caption text-ink-muted uppercase mb-1">
                    Doanh nghiệp
                  </p>
                  <p className="text-heading-md font-light text-ink">
                    {formData.companyName}
                  </p>
                  <p className="text-body-md text-ink-muted">{formData.companyCode}</p>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-caption text-ink-muted uppercase mb-1">
                    Ca làm mặc định
                  </p>
                  <p className="text-heading-md font-light text-ink">
                    {formData.shiftName}
                  </p>
                  <p className="text-body-md text-ink-muted">
                    {formData.startTime}–{formData.endTime}
                  </p>
                </div>
              </Card>

              <Card className="p-6 space-y-3 bg-canvas-soft border-0">
                <h3 className="text-heading-sm font-light text-ink">Danh sách kiểm tra</h3>
                {[
                  'Thông tin doanh nghiệp đã thiết lập',
                  'Ca làm việc mặc định đã tạo',
                  'Sẵn sàng thêm nhân viên đầu tiên',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-body-md text-ink">{item}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            <Button
              className="pill-button-ghost gap-2"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </Button>
            <Button
              className="flex-1 pill-button-primary gap-2"
              onClick={handleNext}
              disabled={loading || (step === 1 && !formData.companyName)}
            >
              {loading ? 'Đang xử lý...' : step === 3 ? 'Hoàn thành' : 'Tiếp tục'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
