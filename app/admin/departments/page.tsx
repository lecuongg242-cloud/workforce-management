'use client'

import React, { useState } from 'react'
import AdminTopbar from '@/components/shared/AdminTopbar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import StatusBadge from '@/components/shared/StatusBadge'
import { mockDepartments, mockEmployees } from '@/lib/mock-data'
import { Plus, Edit2, Trash2 } from 'lucide-react'

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState(mockDepartments)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newDept, setNewDept] = useState({ name: '', managerName: '' })

  const handleAddDepartment = () => {
    if (newDept.name.trim()) {
      setDepartments([
        ...departments,
        {
          id: String(Math.random()),
          name: newDept.name,
          managerId: undefined,
          employeeCount: 0,
          status: 'active',
        },
      ])
      setNewDept({ name: '', managerName: '' })
      setShowAddDialog(false)
    }
  }

  const handleDeleteDepartment = (id: string) => {
    setDepartments(departments.filter((d) => d.id !== id))
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <AdminTopbar
        title="Phòng ban"
        actions={
          <Button
            className="pill-button-primary gap-2"
            size="md"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Thêm phòng ban</span>
          </Button>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-heading-lg font-light text-ink">
              {departments.length} phòng ban
            </h2>
            <p className="text-body-md text-ink-muted mt-1">
              Quản lý các phòng ban của công ty
            </p>
          </div>

          {/* Departments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept) => (
              <Card key={dept.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-heading-md font-light text-ink">
                        {dept.name}
                      </h3>
                    </div>
                    <StatusBadge status={dept.status} />
                  </div>

                  <div className="space-y-2 py-4 border-t border-b border-border">
                    <div className="flex justify-between items-center text-body-md">
                      <span className="text-ink-muted">Nhân viên</span>
                      <span className="text-ink font-medium">{dept.employeeCount}</span>
                    </div>
                    {dept.managerId && (
                      <div className="flex justify-between items-center text-body-md">
                        <span className="text-ink-muted">Quản lý</span>
                        <span className="text-ink">
                          {mockEmployees.find((e) => e.id === dept.managerId)
                            ?.fullName}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 pill-button-secondary gap-2" size="sm">
                      <Edit2 className="h-4 w-4" />
                      Sửa
                    </Button>
                    <button
                      onClick={() => handleDeleteDepartment(dept.id)}
                      className="p-2 hover:bg-canvas-soft rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-ruby" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Add Dialog */}
          {showAddDialog && (
            <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
              <Card className="w-full max-w-md p-6">
                <h3 className="text-heading-md font-light text-ink mb-4">
                  Thêm phòng ban mới
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-body-md font-medium text-ink block mb-2">
                      Tên phòng ban
                    </label>
                    <input
                      type="text"
                      value={newDept.name}
                      onChange={(e) =>
                        setNewDept({ ...newDept, name: e.target.value })
                      }
                      className="input-base w-full"
                      placeholder="VD: Phòng IT"
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button
                      className="pill-button-ghost"
                      onClick={() => setShowAddDialog(false)}
                    >
                      Hủy
                    </Button>
                    <Button
                      className="pill-button-primary"
                      onClick={handleAddDepartment}
                    >
                      Thêm mới
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
