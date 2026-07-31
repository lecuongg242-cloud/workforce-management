import * as React from "react";
import { MapPin, Users } from "lucide-react";

import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTime } from "@/lib/format";
import type { TodayActivityItem } from "@/lib/types/domain";

/** Danh sach nhan vien da cham cong trong ngay */
export function TodayActivity({
  items,
}: {
  items: TodayActivityItem[];
}): React.ReactElement {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Chưa có ai chấm công"
        description="Hoạt động chấm công trong ngày sẽ hiển thị tại đây."
        compact
      />
    );
  }

  return (
    <>
      {/* Bang cho man hinh rong */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nhân viên</TableHead>
              <TableHead>Phòng ban</TableHead>
              <TableHead>Giờ vào</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Địa điểm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.employeeId}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <EmployeeAvatar
                      name={item.employeeName}
                      avatarUrl={item.avatarUrl}
                      size="sm"
                    />
                    <span className="font-medium text-ink">
                      {item.employeeName}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{item.departmentName}</TableCell>
                <TableCell className="num font-medium text-ink">
                  {formatTime(item.checkIn)}
                </TableCell>
                <TableCell>
                  <StatusBadge kind="attendance" value={item.status} size="sm" />
                </TableCell>
                <TableCell className="text-ink-muted">{item.location}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Danh sach the cho dien thoai */}
      <ul className="grid gap-2.5 px-4 pb-4 md:hidden">
        {items.map((item) => (
          <li
            key={item.employeeId}
            className="flex items-start gap-3 rounded-control border border-hairline p-3"
          >
            <EmployeeAvatar
              name={item.employeeName}
              avatarUrl={item.avatarUrl}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {item.employeeName}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {item.departmentName}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                <MapPin aria-hidden="true" className="size-3" />
                {item.location}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="num text-sm font-medium text-ink">
                {formatTime(item.checkIn)}
              </span>
              <StatusBadge kind="attendance" value={item.status} size="sm" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
