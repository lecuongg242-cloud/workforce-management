export type EmploymentStatus = 'active' | 'on-leave' | 'resigned' | 'inactive'
export type ContractType = 'full-time' | 'part-time' | 'contract'
export type AttendanceStatus = 'on-time' | 'late' | 'early-checkout' | 'missing-checkout' | 'leave' | 'absence' | 'day-off'
export type RequestStatus = 'pending' | 'approved' | 'rejected'
export type RequestType = 'leave' | 'attendance-correction' | 'time-adjustment' | 'overtime-registration'
export type Gender = 'male' | 'female' | 'other'

export interface Employee {
  id: string
  fullName: string
  employeeCode: string
  email: string
  phone: string
  dateOfBirth: string
  gender: Gender
  avatar?: string
  departmentId: string
  position: string
  contractType: ContractType
  startDate: string
  directManagerId?: string
  defaultShiftId: string
  workLocation: string
  status: EmploymentStatus
  allowPayslipView: boolean
  allowRemoteCheckIn: boolean
  systemRole: 'admin' | 'manager' | 'employee'
  createdAt: string
}

export interface Department {
  id: string
  name: string
  managerId?: string
  employeeCount: number
  status: 'active' | 'inactive'
}

export interface Shift {
  id: string
  name: string
  code: string
  startTime: string
  endTime: string
  breakDuration: number
  lateAllowance: number
  workDays: number[]
  isOvernight: boolean
  assignedEmployeeCount: number
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  checkInTime?: string
  checkOutTime?: string
  status: AttendanceStatus
  location?: string
  shiftId: string
}

export interface AttendanceRequest {
  id: string
  employeeId: string
  type: RequestType
  startDate: string
  endDate?: string
  startTime?: string
  endTime?: string
  reason: string
  status: RequestStatus
  approverNote?: string
  createdAt: string
  updatedAt: string
}

export interface Company {
  id: string
  name: string
  code: string
  industry: string
  employeeScale: string
  phone: string
  address: string
  logo?: string
  userRole: string
  employeeCount: number
  lastAccessed: string
}

export interface User {
  id: string
  fullName: string
  email: string
  role: 'admin' | 'manager' | 'employee'
  companies: string[]
  currentCompanyId: string
  avatar?: string
}
