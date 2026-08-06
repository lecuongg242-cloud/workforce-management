"use client";

import * as React from "react";

import { StatusBadge } from "@/components/common/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_ATTENDANCE_LABEL } from "@/lib/constants";
import { formatDate, formatDurationShort, formatTime } from "@/lib/format";
import type { AttendanceRecord, Employee } from "@/lib/types/domain";

/**
 * Danh sach TUNG LUOT cham cong — khac han luoi thang, von gop theo ngay.
 *
 * Tu migration 0013 mot ngay co the co nhieu luot; tab nay co y hien tung
 * luot mot, vi day la cho de tra loi cau hoi "luc 14:37 hom do ai cham" —
 * cau hoi ma mot ban tom tat ngay khong tra loi duoc.
 *
 * `workedMinutes` cua MOT DONG la thoi luong THO cua luot do (migration
 * 0014): gio nghi duoc tru mot lan cho ca ngay o tang doc, nen cong tay cac
 * dong o day se ra so LON HON so gio duoc tinh cong. Cot tong cua ngay nam o
 * tab luoi thang, khong nam o day.
 */
export function AttendanceRecordTable({
  records,
  employeeById,
  onOpenRecord,
}: {
  records: AttendanceRecord[];
  employeeById: Map<string, Employee>;
  onOpenRecord: (recordId: string) => void;
}): React.ReactElement {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ngày</TableHead>
            <TableHead>{ADMIN_ATTENDANCE_LABEL.employeeColumn}</TableHead>
            <TableHead>Vào</TableHead>
            <TableHead>Ra</TableHead>
            <TableHead className="text-right">Thời lượng lượt</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Nơi chấm</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const employee = employeeById.get(record.employeeId);
            return (
              <TableRow
                key={record.id}
                onClick={() => onOpenRecord(record.id)}
                className="cursor-pointer"
                title={ADMIN_ATTENDANCE_LABEL.openDetail}
              >
                <TableCell className="num whitespace-nowrap text-ink-secondary">
                  {formatDate(record.date)}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-ink">
                    {/* Thieu ho so nhan vien la du lieu khong dong bo — lui ve
                        dinh danh chu khong bo trong, de dong do van tra cuu duoc. */}
                    {employee?.fullName ?? record.employeeId}
                  </div>
                  <div className="num text-xs text-ink-muted">
                    {employee?.code ?? "—"}
                  </div>
                </TableCell>
                <TableCell className="num whitespace-nowrap text-ink-secondary">
                  {formatTime(record.checkIn)}
                </TableCell>
                <TableCell className="num whitespace-nowrap text-ink-secondary">
                  {formatTime(record.checkOut)}
                </TableCell>
                <TableCell className="num whitespace-nowrap text-right text-ink-secondary">
                  {record.checkIn === null
                    ? "—"
                    : formatDurationShort(record.workedMinutes)}
                </TableCell>
                <TableCell>
                  <StatusBadge kind="attendance" value={record.status} size="sm" />
                </TableCell>
                <TableCell className="max-w-[14rem] truncate text-ink-secondary">
                  {record.location}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
