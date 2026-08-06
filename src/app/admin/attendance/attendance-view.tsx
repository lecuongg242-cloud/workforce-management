"use client";

import * as React from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import { AttendanceMonthGrid, type GridRow } from "@/components/attendance/attendance-month-grid";
import { AttendancePhotoDialog } from "@/components/attendance/attendance-photo-dialog";
import { AttendanceRecordTable } from "@/components/attendance/attendance-record-table";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { SearchInput } from "@/components/common/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDataQuery } from "@/hooks/use-data-query";
import { useDebounce } from "@/hooks/use-debounce";
import { groupAttendanceByDay, shiftBreakInfoById } from "@/lib/attendance/day";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { ADMIN_ATTENDANCE_LABEL } from "@/lib/constants";
import { listAttendance } from "@/lib/data/attendance";
import { listDepartments } from "@/lib/data/departments";
import { listAllEmployees } from "@/lib/data/employees";
import { listShifts } from "@/lib/data/shifts";
import { formatMonthLabel, formatNumber, normalizeText, shiftMonth } from "@/lib/format";
import type { AttendanceRecord, Employee } from "@/lib/types/domain";

/**
 * Bang cong cua quan tri — hai tab tren CUNG mot tap du lieu cua thang:
 *
 *   - LUOI THANG (mac dinh): mot dong moi nhan vien, mot cot moi ngay. De
 *     soat ca thang truoc khi chot ky — cau hoi "ai thieu cong ngay nao".
 *   - DANH SACH: tung luot cham cong. De tra loi "luc do ai cham, o dau" —
 *     cau hoi ma mot ban tom tat ngay khong tra loi duoc.
 *
 * PHEP GOP NGAY DUNG CHUNG voi phia server: `groupAttendanceByDay()` +
 * `shiftBreakInfoById()` la dung hai ham ma `month-context.ts` goi. Neu o day
 * tu cong `workedMinutes` cua tung dong thi tu migration 0014 con so se LON
 * HON so gio duoc tinh cong — va man hinh nay se cai nhau voi bang luong.
 *
 * "Thang" khoi tao tu NGAY CUA SERVER (prop `today`), khong tu `new Date()` —
 * rule ESLint `timeflow/no-date-in-client` cuong che dieu do tren toan `src/`.
 */
export function AttendanceView({ today }: { today: string }): React.ReactElement {
  const session = useAuthenticatedSession();

  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [departmentId, setDepartmentId] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [openRecordId, setOpenRecordId] = React.useState<string | null>(null);

  const { data, isLoading, error, reload } = useDataQuery(async () => {
    const [records, employees, shifts, departments] = await Promise.all([
      listAttendance({ companyId: session.companyId, month }),
      listAllEmployees(session.companyId),
      listShifts(session.companyId),
      listDepartments(session.companyId),
    ]);
    return { records, employees, shifts, departments };
  }, [session.companyId, month]);

  const breaks = React.useMemo(
    () =>
      shiftBreakInfoById(
        (data?.shifts ?? []).map((shift) => ({
          id: shift.id,
          breakMinutes: shift.breakMinutes,
          startTime: shift.startTime,
          endTime: shift.endTime,
        })),
      ),
    [data],
  );

  const employeeById = React.useMemo(() => {
    const map = new Map<string, Employee>();
    for (const employee of data?.employees ?? []) map.set(employee.id, employee);
    return map;
  }, [data]);

  /** Ban ghi cua thang, gom theo nhan vien — dung cho ca hai tab. */
  const recordsByEmployee = React.useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const record of data?.records ?? []) {
      const list = map.get(record.employeeId);
      if (list) list.push(record);
      else map.set(record.employeeId, [record]);
    }
    return map;
  }, [data]);

  /**
   * Nhan vien duoc hien: khong phai nguoi da nghi viec, HOAC co ban ghi trong
   * thang. Nghi viec giua thang khong xoa di nhung ngay ho da lam — cung quy
   * tac ma `GET /api/payroll/summary` dung, de hai man hinh khong lech danh
   * sach nguoi.
   */
  const visibleEmployees = React.useMemo(() => {
    const keyword = normalizeText(debouncedSearch.trim());
    return (data?.employees ?? [])
      .filter(
        (employee) =>
          employee.status !== "terminated" || recordsByEmployee.has(employee.id),
      )
      .filter(
        (employee) => departmentId === "all" || employee.departmentId === departmentId,
      )
      .filter((employee) => {
        if (!keyword) return true;
        return (
          normalizeText(employee.fullName).includes(keyword) ||
          normalizeText(employee.code).includes(keyword)
        );
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [data, departmentId, debouncedSearch, recordsByEmployee]);

  const gridRows: GridRow[] = React.useMemo(
    () =>
      visibleEmployees.map((employee) => {
        const days = groupAttendanceByDay(
          recordsByEmployee.get(employee.id) ?? [],
          breaks,
        );
        return {
          employee,
          daysByDate: new Map(days.map((day) => [day.date, day])),
          workedDays: days.filter((day) => day.workedMinutes > 0).length,
        };
      }),
    [visibleEmployees, recordsByEmployee, breaks],
  );

  /** Danh sach luot: chi cua nhung nhan vien dang hien, giu thu tu server tra. */
  const visibleRecords = React.useMemo(() => {
    const allowed = new Set(visibleEmployees.map((employee) => employee.id));
    return (data?.records ?? []).filter((record) => allowed.has(record.employeeId));
  }, [data, visibleEmployees]);

  const hasAnyRecord = (data?.records ?? []).length > 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={ADMIN_ATTENDANCE_LABEL.pageTitle}
        description={
          data ? (
            <>
              <span className="num font-medium text-ink">
                {formatNumber(visibleEmployees.length)}
              </span>{" "}
              nhân viên,{" "}
              <span className="num font-medium text-ink">
                {formatNumber(visibleRecords.length)}
              </span>{" "}
              lượt chấm công. {ADMIN_ATTENDANCE_LABEL.pageDescription}
            </>
          ) : (
            "Đang tải dữ liệu chấm công…"
          )
        }
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              aria-label="Tháng trước"
              onClick={() => setMonth((current) => shiftMonth(current, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span className="num min-w-[8.5rem] text-center text-sm font-medium text-ink">
              {formatMonthLabel(month)}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Tháng sau"
              onClick={() => setMonth((current) => shiftMonth(current, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        }
      />

      <div className="surface-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-hairline p-3 lg:flex-row lg:items-center">
          <div className="lg:w-72">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder={ADMIN_ATTENDANCE_LABEL.searchPlaceholder}
            />
          </div>
          <div className="lg:w-56">
            <label htmlFor="attendance-department-filter" className="sr-only">
              Lọc theo phòng ban
            </label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger id="attendance-department-filter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {ADMIN_ATTENDANCE_LABEL.allDepartments}
                </SelectItem>
                {(data?.departments ?? []).map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading || !data ? (
          <DataTableSkeleton rows={6} columns={7} />
        ) : !hasAnyRecord ? (
          <EmptyState
            icon={CalendarRange}
            title={ADMIN_ATTENDANCE_LABEL.emptyTitle}
            description={ADMIN_ATTENDANCE_LABEL.emptyBody}
          />
        ) : visibleEmployees.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title={ADMIN_ATTENDANCE_LABEL.emptyFilteredTitle}
            description={ADMIN_ATTENDANCE_LABEL.emptyFilteredBody}
          />
        ) : (
          <Tabs defaultValue="grid">
            <TabsList className="m-3">
              <TabsTrigger value="grid">
                {ADMIN_ATTENDANCE_LABEL.gridTab}
              </TabsTrigger>
              <TabsTrigger value="list">
                {ADMIN_ATTENDANCE_LABEL.listTab}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grid">
              <AttendanceMonthGrid
                month={month}
                rows={gridRows}
                onOpenRecord={setOpenRecordId}
              />
            </TabsContent>

            <TabsContent value="list">
              <AttendanceRecordTable
                records={visibleRecords}
                employeeById={employeeById}
                onOpenRecord={setOpenRecordId}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Dung lai Dialog bang chung cua 03-05 — khong dung mot ban thu hai. */}
      <AttendancePhotoDialog
        attendanceRecordId={openRecordId}
        onOpenChange={(open) => {
          if (!open) setOpenRecordId(null);
        }}
      />
    </div>
  );
}
