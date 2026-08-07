"use client";

import * as React from "react";
import Link from "next/link";

import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeRowActions } from "@/components/employees/employee-row-actions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CONTRACT_TYPE_LABEL, NOT_DECLARED } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Employee } from "@/lib/types/domain";

/** Bang nhan vien cho man hinh tu 768px tro len */
export function EmployeeTable({
  employees,
  departmentNames,
  selectedIds,
  onToggleOne,
  onToggleAll,
  onMoveDepartment,
  onResendInvite,
  onTerminate,
}: {
  employees: Employee[];
  departmentNames: Record<string, string>;
  selectedIds: string[];
  onToggleOne: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onMoveDepartment: (employee: Employee) => void;
  onResendInvite: (employee: Employee) => void;
  onTerminate: (employee: Employee) => void;
}): React.ReactElement {
  const allSelected =
    employees.length > 0 && employees.every((item) => selectedIds.includes(item.id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10 pr-0">
            <Checkbox
              aria-label="Chọn tất cả nhân viên trong trang"
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => onToggleAll(checked === true)}
            />
          </TableHead>
          <TableHead>Nhân viên</TableHead>
          <TableHead>Mã nhân viên</TableHead>
          <TableHead>Phòng ban</TableHead>
          <TableHead>Chức vụ</TableHead>
          <TableHead>Loại hợp đồng</TableHead>
          <TableHead>Ngày bắt đầu</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead className="w-12 text-right">
            <span className="sr-only">Hành động</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => {
          const isSelected = selectedIds.includes(employee.id);
          return (
            <TableRow
              key={employee.id}
              data-state={isSelected ? "selected" : undefined}
            >
              <TableCell className="pr-0">
                <Checkbox
                  aria-label={`Chọn ${employee.fullName}`}
                  checked={isSelected}
                  onCheckedChange={(checked) =>
                    onToggleOne(employee.id, checked === true)
                  }
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <EmployeeAvatar
                    name={employee.fullName}
                    avatarUrl={employee.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <Link
                      href={`/admin/employees/${employee.id}`}
                      className="block truncate rounded-sm font-medium text-ink hover:text-brand"
                    >
                      {employee.fullName}
                    </Link>
                    <span className="block max-w-[220px] truncate text-xs text-ink-muted">
                      {employee.email}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="num">{employee.code}</TableCell>
              <TableCell>
                {employee.departmentId
                  ? (departmentNames[employee.departmentId] ?? NOT_DECLARED)
                  : NOT_DECLARED}
              </TableCell>
              <TableCell className="max-w-[180px] truncate">
                {employee.position ?? NOT_DECLARED}
              </TableCell>
              <TableCell>
                {employee.contractType
                  ? CONTRACT_TYPE_LABEL[employee.contractType]
                  : NOT_DECLARED}
              </TableCell>
              <TableCell className="num">{formatDate(employee.startDate)}</TableCell>
              <TableCell>
                <StatusBadge kind="employee" value={employee.status} size="sm" />
              </TableCell>
              <TableCell className="text-right">
                <EmployeeRowActions
                  employee={employee}
                  onMoveDepartment={onMoveDepartment}
                  onResendInvite={onResendInvite}
                  onTerminate={onTerminate}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
