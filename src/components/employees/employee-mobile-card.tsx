"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeRowActions } from "@/components/employees/employee-row-actions";
import { Checkbox } from "@/components/ui/checkbox";
import type { Employee } from "@/lib/types/domain";

/**
 * The nhan vien danh cho dien thoai — khong thu nho bang cua may tinh.
 * Cham vao the de mo trang chi tiet.
 */
export function EmployeeMobileCard({
  employee,
  departmentName,
  isSelected,
  onToggle,
  onMoveDepartment,
  onResendInvite,
  onTerminate,
}: {
  employee: Employee;
  departmentName: string;
  isSelected: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onMoveDepartment: (employee: Employee) => void;
  onResendInvite: (employee: Employee) => void;
  onTerminate: (employee: Employee) => void;
}): React.ReactElement {
  const router = useRouter();

  return (
    <article className="surface-card p-3.5">
      <div className="flex items-start gap-3">
        <Checkbox
          aria-label={`Chọn ${employee.fullName}`}
          checked={isSelected}
          onCheckedChange={(checked) => onToggle(employee.id, checked === true)}
          className="mt-1"
        />

        <button
          type="button"
          onClick={() => router.push(`/admin/employees/${employee.id}`)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <EmployeeAvatar
            name={employee.fullName}
            avatarUrl={employee.avatarUrl}
            size="md"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-ink">
              {employee.fullName}
            </span>
            <span className="num block text-[13px] text-ink-muted">
              {employee.code}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-canvas-soft px-2 py-0.5 text-[11px] text-ink-secondary">
                {departmentName}
              </span>
              <StatusBadge kind="employee" value={employee.status} size="sm" />
            </span>
          </span>
        </button>

        <EmployeeRowActions
          employee={employee}
          onMoveDepartment={onMoveDepartment}
          onResendInvite={onResendInvite}
          onTerminate={onTerminate}
        />
      </div>
    </article>
  );
}
