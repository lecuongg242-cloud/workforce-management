'use client';

import { useState } from 'react';
import { Search, Trash2, Edit2 } from 'lucide-react';
import { deleteEmployee } from '@/lib/actions/employee';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { EditEmployeeDialog } from './edit-employee-dialog';
import { formatDate } from '@/lib/utils';
import type { Employee, Department } from '@/types';

interface EmployeesListProps {
  employees: Employee[];
  departments: Department[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (value: string) => void;
  tenantId: string;
  onEmployeeUpdated: () => void;
}

export function EmployeesList({
  employees,
  departments,
  loading,
  searchTerm,
  onSearchChange,
  departmentFilter,
  onDepartmentFilterChange,
  tenantId,
  onEmployeeUpdated,
}: EmployeesListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(employeeId: string) {
    setDeleting(employeeId);
    const result = await deleteEmployee(tenantId, employeeId);
    if (result.success) {
      onEmployeeUpdated();
    }
    setDeleting(null);
  }

  const getDepartmentName = (deptId?: string) => {
    if (!deptId) return 'N/A';
    return departments.find((d) => d.id === deptId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-foreground/50" />
          <Input
            placeholder="Search by name, code, or email..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={departmentFilter} onValueChange={onDepartmentFilterChange}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-foreground/60">Loading employees...</div>
      ) : employees.length === 0 ? (
        <div className="text-center py-8 text-foreground/60">
          No employees found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Hire Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-mono text-sm">{employee.employee_code}</TableCell>
                  <TableCell>
                    {employee.first_name} {employee.last_name}
                  </TableCell>
                  <TableCell>{employee.email || '-'}</TableCell>
                  <TableCell>{employee.position || '-'}</TableCell>
                  <TableCell>{getDepartmentName(employee.department_id)}</TableCell>
                  <TableCell>
                    {employee.hire_date ? formatDate(employee.hire_date) : '-'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        employee.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {employee.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <EditEmployeeDialog
                        tenantId={tenantId}
                        employee={employee}
                        departments={departments}
                        onSuccess={onEmployeeUpdated}
                      />

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this employee? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="flex gap-3">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(employee.id)}
                              disabled={deleting === employee.id}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              {deleting === employee.id ? 'Deleting...' : 'Delete'}
                            </AlertDialogAction>
                          </div>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
