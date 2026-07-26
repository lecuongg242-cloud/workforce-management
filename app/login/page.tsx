'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import AppLogo from '@/components/shared/AppLogo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 800))
      router.push('/select-company')
    } catch (err) {
      setError('Đăng nhập không thành công')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Gradient Mesh & Marketing */}
      <div className="hidden lg:flex lg:w-1/2 gradient-mesh flex-col items-center justify-center p-12">
        <div className="w-full max-w-md">
          <AppLogo className="mb-16" size="lg" />

          <div className="space-y-4 mb-16">
            <h1 className="text-display-xl font-light text-ink leading-tight">
              Quản lý thời gian làm việc rõ ràng và chính xác hơn.
            </h1>
            <p className="text-body-lg text-ink-secondary">
              Chấm công, quản lý nhân viên và chuẩn bị dữ liệu tính lương trong một hệ thống duy nhất.
            </p>
          </div>

          {/* Dashboard Mockup */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-border">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted uppercase">TỔNG NHÂN VIÊN</span>
                <span className="text-heading-lg font-light text-ink">28</span>
              </div>
              <div className="h-px bg-border"></div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <span className="text-xs text-ink-muted">Đã chấm công</span>
                  <p className="text-display-md font-light text-primary">22</p>
                </div>
                <div className="flex-1">
                  <span className="text-xs text-ink-muted">Đi muộn</span>
                  <p className="text-display-md font-light text-ruby">3</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-6 py-12 lg:p-12 bg-canvas-soft lg:bg-canvas">
        {/* Mobile Logo */}
        <div className="mb-8 lg:hidden">
          <AppLogo size="md" />
        </div>

        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-heading-lg font-light text-ink">Đăng nhập</h2>
            <p className="text-body-md text-ink-muted mt-1">
              Nhập thông tin tài khoản của bạn
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-ruby/10 p-4 border border-ruby/20">
              <p className="text-body-md text-ruby">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.currentTarget.checked)}
                />
                <label
                  htmlFor="remember"
                  className="text-body-md text-ink cursor-pointer font-medium"
                >
                  Nhớ đăng nhập
                </label>
              </div>
              <Link
                href="#"
                className="text-body-md text-primary hover:text-primary-deep font-medium"
              >
                Quên mật khẩu?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full pill-button-primary"
              disabled={loading}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>

          <div className="text-center">
            <span className="text-body-md text-ink-secondary">
              Chưa có tài khoản?{' '}
              <Link
                href="/onboarding"
                className="text-primary hover:text-primary-deep font-medium"
              >
                Tạo tài khoản doanh nghiệp
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
