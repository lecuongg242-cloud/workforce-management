"use client";

import * as React from "react";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { displayAttendanceStatus } from "@/lib/attendance/display-status";
import { ADMIN_ATTENDANCE_LABEL, ATTENDANCE_EDIT_LABELS } from "@/lib/constants";
import {
  formatDate,
  formatDurationShort,
  formatInstant,
  formatTime,
} from "@/lib/format";
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
  shiftNameById,
  today,
  onOpenRecord,
  onEditRecord,
  onDeleteRecord,
}: {
  records: AttendanceRecord[];
  employeeById: Map<string, Employee>;
  /**
   * Ten ca theo dinh danh. Moi dong tra cuu bang `record.shiftId` — ca cua
   * CHINH NGAY DO, khong phai ca hien tai cua nhan vien: doi ca khong sua lich
   * su, nen mot ngay cu van mang ca cu.
   */
  shiftNameById: Map<string, string>;
  /** "YYYY-MM-DD" theo dong ho MAY CHU — de phan biet "đang làm việc" voi
   *  "thiếu giờ ra". Xem `display-status.ts`. */
  today: string;
  onOpenRecord: (recordId: string) => void;
  /** `null` = nguoi dang xem khong co quyen sua; cot hanh dong bi an han. */
  onEditRecord: ((record: AttendanceRecord) => void) | null;
  onDeleteRecord: ((record: AttendanceRecord) => void) | null;
}): React.ReactElement {
  const canEdit = onEditRecord !== null && onDeleteRecord !== null;
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
            <TableHead>Ca</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Nơi chấm</TableHead>
            {canEdit ? <TableHead className="w-12" /> : null}
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
                <TableCell className="whitespace-nowrap text-ink-muted">
                  {shiftNameById.get(record.shiftId) ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    kind="attendance"
                    value={displayAttendanceStatus({
                      status: record.status,
                      checkIn: record.checkIn,
                      checkOut: record.checkOut,
                      date: record.date,
                      today,
                    })}
                    size="sm"
                  />
                  {record.editedAt ? (
                    <span
                      className="mt-1 block text-[11px] text-ink-muted"
                      title={`${ATTENDANCE_EDIT_LABELS.editedBadge} bởi ${
                        record.editedByName ?? ATTENDANCE_EDIT_LABELS.editedByUnknown
                      } lúc ${formatInstant(record.editedAt)}`}
                    >
                      {ATTENDANCE_EDIT_LABELS.editedBadge}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-[14rem] truncate text-ink-secondary">
                  {record.location}
                </TableCell>
                {canEdit ? (
                  <TableCell>
                    {/* `stopPropagation` BAT BUOC: ca dong la mot nut mo hop
                        thoai bang chung cham cong. Thieu no thi bam "Xoá" se
                        vua mo anh len vua hoi xoa. */}
                    <div onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={ATTENDANCE_EDIT_LABELS.rowActionsLabel}
                          className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-canvas-soft hover:text-ink"
                        >
                          <MoreHorizontal aria-hidden="true" className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => onEditRecord(record)}>
                            <Pencil aria-hidden="true" />
                            {ATTENDANCE_EDIT_LABELS.editAction}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onDeleteRecord(record)}
                          >
                            <Trash2 aria-hidden="true" />
                            {ATTENDANCE_EDIT_LABELS.deleteAction}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
