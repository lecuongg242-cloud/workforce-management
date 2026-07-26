'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getEmployees } from '@/lib/actions/employee';
import { getDepartments } from '@/lib/actions/department';
import type { Employee, Department } from '@/types';
import { EmployeesList } from '@/components/employees/employees-list';
import { AddEmployeeDialog } from '@/components/employees/add-employee-dialog';
import { Card } from '@/components/ui/card';

export default function EmployeesPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [employeesData, departmentsData] = await Promise.all([
        getEmployees(tenantId, {
          search: searchTerm,
          departmentId: departmentFilter || undefined,
        }),
        getDepartments(tenantId),
      ]);

      setEmployees(employeesData);
      setDepartments(departmentsData);
      setLoading(false);
    }

    loadData();
  }, [tenantId, searchTerm, departmentFilter]);

  const handleEmployeeAdded = () => {
    // Refresh employees list
    getEmployees(tenantId, {
      search: searchTerm,
      departmentId: departmentFilter || undefined,
    }).then(setEmployees);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-foreground/60">Manage your organization&apos;s employees</p>
        </div>
        <AddEmployeeDialog tenantId={tenantId} departments={departments} onSuccess={handleEmployeeAdded} />
      </div>

      <Card className="p-4">
        <EmployeesList
          employees={employees}
          departments={departments}
          loading={loading}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          departmentFilter={departmentFilter}
          onDepartmentFilterChange={setDepartmentFilter}
          tenantId={tenantId}
          onEmployeeUpdated={handleEmployeeAdded}
        />
      </Card>
    </div>
  );
}
