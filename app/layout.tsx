import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'vietnamese'] })

export const metadata: Metadata = {
  title: 'TimeFlow - Quản lý thời gian làm việc',
  description: 'Chấm công, quản lý nhân viên và chuẩn bị dữ liệu tính lương trong một hệ thống duy nhất.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" className="bg-canvas">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
