'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import AdminTopbar from '@/components/shared/AdminTopbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import StatusBadge from '@/components/shared/StatusBadge'
import EmployeeAvatar from '@/components/shared/EmployeeAvatar'
import { Card } from '@/components/ui/card'
import { mockEmployees, mockDepartments } from '@/lib/mock-data'
import {
  Plus,
  Upload,
  Search,
  ChevronUp,
  ChevronDown,
  MoreVertical,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [contractFilter, setContractFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'startDate'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(
    new Set()
  )

  // Filter and sort employees
  const filteredEmployees = useMemo(() => {
    let result = [...mockEmployees]

    if (searchTerm) {
      result = result.filter(
        (e) =>
          e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (departmentFilter) {
      result = result.filter((e) => e.departmentId === departmentFilter)
    }

    if (statusFilter) {
      result = result.filter((e) => e.status === statusFilter)
    }

    if (contractFilter) {
      result = result.filter((e) => e.contractType === contractFilter)
    }

    // Sort
    result.sort((a, b) => {
      let compareA, compareB
      switch (sortBy) {
        case 'code':
          compareA = a.employeeCode
          compareB = b.employeeCode
          break
        case 'startDate':
          compareA = a.startDate
          compareB = b.startDate
          break
        default:
          compareA = a.fullName
          compareB = b.fullName
      }

      const comparison = compareA.localeCompare(compareB, 'vi')
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [searchTerm, departmentFilter, statusFilter, contractFilter, sortBy, sortOrder])

  const handleSort = (key: 'name' | 'code' | 'startDate') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
  }

  const toggleSelectAll = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set())
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map((e) => e.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedEmployees)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedEmployees(newSet)
  }

  const hasFilters = searchTerm || departmentFilter || statusFilter || contractFilter

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <AdminTopbar
        title="Nhân viên"
        actions={
          <div className="flex gap-2">
            <Button className="pill-button-secondary gap-2 hidden sm:flex" size="md">
              <Upload className="h-4 w-4" />
              Nhập từ Excel
            </Button>
            <Link href="/admin/employees/new">
              <Button className="pill-button-primary gap-2" size="md">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Thêm nhân viên</span>
              </Button>
            </Link>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-heading-lg font-light text-ink">
              {filteredEmployees.length} nhân viên
            </h2>
            <p className="text-body-md text-ink-muted mt-1">
              Quản lý danh sách nhân viên của công ty
            </p>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                type="text"
                placeholder="Tìm kiếm tên, mã nhân viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="input-base"
              >
                <option value="">Tất cả phòng ban</option>
                {mockDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-base"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang làm việc</option>
                <option value="on-leave">Đang nghỉ phép</option>
                <option value="resigned">Đã nghỉ việc</option>
                <option value="inactive">Chưa kích hoạt</option>
              </select>
              <select
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value)}
                className="input-base"
              >
                <option value="">Tất cả loại hợp đồng</option>
                <option value="full-time">Toàn thời gian</option>
                <option value="part-time">Bán thời gian</option>
                <option value="contract">Hợp đồng</option>
              </select>
              {hasFilters && (
                <Button
                  className="pill-button-ghost w-full"
                  onClick={() => {
                    setSearchTerm('')
                    setDepartmentFilter('')
                    setStatusFilter('')
                    setContractFilter('')
                  }}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-body-md">
                <thead className="border-b border-border bg-canvas-soft">
                  <tr>
                    <th className="py-3 px-4 text-left">
                      <input
                        type="checkbox"
                        checked={
                          filteredEmployees.length > 0 &&
                          selectedEmployees.size === filteredEmployees.length
                        }
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th
                      className="py-3 px-4 text-left text-ink-muted font-medium cursor-pointer hover:text-ink"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Nhân viên
                        {sortBy === 'name' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 text-left text-ink-muted font-medium cursor-pointer hover:text-ink"
                      onClick={() => handleSort('code')}
                    >
                      <div className="flex items-center gap-2">
                        Mã nhân viên
                        {sortBy === 'code' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-left text-ink-muted font-medium">
                      Phòng ban
                    </th>
                    <th className="py-3 px-4 text-left text-ink-muted font-medium">
                      Chức vụ
                    </th>
                    <th className="py-3 px-4 text-left text-ink-muted font-medium">
                      Loại hợp đồng
                    </th>
                    <th
                      className="py-3 px-4 text-left text-ink-muted font-medium cursor-pointer hover:text-ink"
                      onClick={() => handleSort('startDate')}
                    >
                      <div className="flex items-center gap-2">
                        Ngày bắt đầu
                        {sortBy === 'startDate' &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-left text-ink-muted font-medium">
                      Trạng thái
                    </th>
                    <th className="py-3 px-4 text-center text-ink-muted font-medium">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-b border-border hover:bg-canvas-soft"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.has(employee.id)}
                          onChange={() => toggleSelect(employee.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/admin/employees/${employee.id}`}>
                          <div className="flex items-center gap-3 hover:text-primary">
                            <EmployeeAvatar name={employee.fullName} size="sm" />
                            {employee.fullName}
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-ink-muted">{employee.employeeCode}</td>
                      <td className="py-3 px-4 text-ink-muted">{employee.departmentId}</td>
                      <td className="py-3 px-4 text-ink-muted">{employee.position}</td>
                      <td className="py-3 px-4 text-ink-muted">
                        <StatusBadge status={employee.contractType} />
                      </td>
                      <td className="py-3 px-4 text-ink-muted">
                        {formatDate(employee.startDate)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={employee.status} />
                      </td>
                      <td className="py-3 px-4">
                        <button className="p-2 hover:bg-canvas-soft rounded transition-colors">
                          <MoreVertical className="h-4 w-4 text-ink-muted" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 md:hidden gap-4">
            {filteredEmployees.map((employee) => (
              <Card key={employee.id} className="p-4">
                <Link href={`/admin/employees/${employee.id}`}>
                  <div className="flex items-start gap-3 mb-4">
                    <EmployeeAvatar name={employee.fullName} size="md" />
                    <div className="flex-1">
                      <h3 className="text-body-md font-medium text-ink">
                        {employee.fullName}
                      </h3>
                      <p className="text-caption text-ink-muted">{employee.employeeCode}</p>
                    </div>
                  </div>
                </Link>
                <div className="space-y-2 text-body-md">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Phòng ban:</span>
                    <span className="text-ink">{employee.departmentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Chức vụ:</span>
                    <span className="text-ink">{employee.position}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Trạng thái:</span>
                    <StatusBadge status={employee.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredEmployees.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-body-lg text-ink-muted">Không tìm thấy nhân viên nào</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
