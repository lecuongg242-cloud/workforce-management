import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function formatTime(time: string): string {
  return time
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(value)
}

export function formatDateTime(date: string, time?: string): string {
  const d = new Date(date + 'T00:00:00')
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  const formatted = `${day}/${month}/${year}`
  return time ? `${formatted} ${time}` : formatted
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getDayOfWeek(date: string): string {
  const days = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
  const d = new Date(date + 'T00:00:00')
  return days[d.getDay()]
}

export function getStatusBadgeClass(status: string): string {
  const statusMap: Record<string, string> = {
    'on-time': 'status-on-time',
    late: 'status-late',
    absence: 'status-absent',
    'day-off': 'status-on-time',
    leave: 'status-pending',
    'early-checkout': 'status-late',
    'missing-checkout': 'status-absent',
    active: 'status-on-time',
    resigned: 'status-absent',
    'on-leave': 'status-pending',
    inactive: 'status-late',
    pending: 'status-pending',
    approved: 'status-approved',
    rejected: 'status-rejected',
  }
  return statusMap[status] || 'status-pending'
}

export function getStatusLabel(status: string): string {
  const labelMap: Record<string, string> = {
    'on-time': 'Đúng giờ',
    late: 'Đi muộn',
    'early-checkout': 'Về sớm',
    'missing-checkout': 'Thiếu giờ ra',
    leave: 'Nghỉ phép',
    absence: 'Nghỉ không phép',
    'day-off': 'Ngày nghỉ',
    active: 'Đang làm việc',
    resigned: 'Đã nghỉ việc',
    'on-leave': 'Đang nghỉ phép',
    inactive: 'Chưa kích hoạt',
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    'full-time': 'Toàn thời gian',
    'part-time': 'Bán thời gian',
    contract: 'Hợp đồng',
  }
  return labelMap[status] || status
}

export function calculateWorkHours(checkIn: string, checkOut: string, breakMinutes: number = 0): string {
  const [inHour, inMin] = checkIn.split(':').map(Number)
  const [outHour, outMin] = checkOut.split(':').map(Number)

  let inTotalMin = inHour * 60 + inMin
  let outTotalMin = outHour * 60 + outMin

  if (outTotalMin < inTotalMin) {
    outTotalMin += 24 * 60
  }

  const diffMin = outTotalMin - inTotalMin - breakMinutes
  const hours = Math.floor(diffMin / 60)
  const minutes = diffMin % 60

  return `${hours}h${minutes > 0 ? `${minutes}m` : ''}`
}

export function isToday(date: string): boolean {
  const today = new Date()
  const d = new Date(date + 'T00:00:00')
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}
