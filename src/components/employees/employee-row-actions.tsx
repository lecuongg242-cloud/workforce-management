"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, MailPlus, MoreHorizontal, Network, UserMinus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Employee } from "@/lib/types/domain";

/** Menu ba cham dung chung cho ca bang va the tren dien thoai */
export function EmployeeRowActions({
  employee,
  onMoveDepartment,
  onResendInvite,
  onTerminate,
}: {
  employee: Employee;
  onMoveDepartment: (employee: Employee) => void;
  onResendInvite: (employee: Employee) => void;
  onTerminate: (employee: Employee) => void;
}): React.ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Hành động cho ${employee.fullName}`}
        className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-canvas-soft hover:text-ink"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href={`/admin/employees/${employee.id}`}>
            <Eye aria-hidden="true" />
            Xem chi tiết
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onMoveDepartment(employee)}>
          <Network aria-hidden="true" />
          Chuyển phòng ban
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onResendInvite(employee)}
          disabled={employee.status === "terminated"}
        >
          <MailPlus aria-hidden="true" />
          Gửi lại lời mời
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={employee.status === "terminated"}
          onSelect={() => onTerminate(employee)}
        >
          <UserMinus aria-hidden="true" />
          Đánh dấu đã nghỉ việc
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
