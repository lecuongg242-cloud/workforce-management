"use client";

import * as React from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { AttendanceMonthGrid, type GridRow } from "@/components/attendance/attendance-month-grid";
import { AttendancePhotoDialog } from "@/components/attendance/attendance-photo-dialog";
import { AttendanceRecordTable } from "@/components/attendance/attendance-record-table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { SearchInput } from "@/components/common/search-input";
import { StatusBadge } from "@/components/common/status-badge";
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
import { ADMIN_ATTENDANCE_LABEL, PERIOD_LABEL } from "@/lib/constants";
import { listAttendance } from "@/lib/data/attendance";
import { listDepartments } from "@/lib/data/departments";
import { listAllEmployees } from "@/lib/data/employees";
import { closePeriod, listPeriods } from "@/lib/data/periods";
import { listShifts } from "@/lib/data/shifts";
import { useDataStore } from "@/lib/data/store";
import {
  formatDateTime,
  formatMonthLabel,
  formatNumber,
  normalizeText,
  shiftMonth,
} from "@/lib/format";
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

  const { invalidate } = useDataStore();

  /* ------------------------------------------------------------------ */
  /* Ky cong cua CHINH thang dang xem (gop tu trang /admin/periods cu)   */
  /*                                                                     */
  /* Chot ky la thao tac dong khung so lieu cua mot thang, nen no thuoc  */
  /* ve chinh man hinh dang hien so lieu thang do — mot trang rieng bat  */
  /* nguoi dung roi bang cong, chon lai thang mot lan nua roi bam chot   */
  /* mot con so ho khong con nhin thay.                                  */
  /* ------------------------------------------------------------------ */
  const { data: periods, reload: reloadPeriods } = useDataQuery(
    () => listPeriods(),
    [session.companyId],
  );
  const period = (periods ?? []).find((item) => item.month === month) ?? null;
  const isPeriodClosed = period?.status === "closed";

  const [confirmClose, setConfirmClose] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);

  const handleClosePeriod = async (): Promise<void> => {
    setIsClosing(true);
    try {
      await closePeriod(month);
      invalidate();
      reloadPeriods();
      toast.success(PERIOD_LABEL.closeSuccess, {
        description: `Kỳ ${formatMonthLabel(month)} đã khoá.`,
      });
      setConfirmClose(false);
    } catch (cause) {
      // Thong diep tu ham SQL da noi ro ly do (chua ket thuc / da chot) —
      // hien nguyen van.
      toast.error(
        cause instanceof Error ? cause.message : PERIOD_LABEL.closeError,
      );
    } finally {
      setIsClosing(false);
    }
  };

  const { data, isLoading, error, reload } = useDataQuery(async () => {
    const [records, employees, shifts, departments] = await Promise.all([
      listAttendance({ companyId: session.companyId, month }),
      listAllEmployees(session.companyId),
      listShifts(session.companyId),
      listDepartments(session.companyId),
    ]);
    return { records, employees, shifts, departments };
  }, [session.companyId, month]);

  // Ten ca theo dinh danh — moi dong tra cuu bang `record.shiftId`, tuc ca cua
  // CHINH ngay do chu khong phai ca hien tai cua nhan vien.
  const shiftNameById = React.useMemo(
    () => new Map((data?.shifts ?? []).map((shift) => [shift.id, shift.name])),
    [data],
  );

  const breaks = React.useMemo(
    () =>
      shiftBreakInfoById(
        (data?.shifts ?? []).map((shift) => ({
          id: shift.id,
          kind: shift.kind,
          breakMinutes: shift.breakMinutes,
          startTime: shift.startTime,
          endTime: shift.endTime,
          durationMinutes: shift.durationMinutes,
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

            {/* CHOT KY ngay tai day: thao tac khoa so lieu dung canh chinh so
                lieu no khoa. Ky chua ket thuc thi khong co nut — cau giai
                thich nam o dong trang thai ben duoi, khong phai mot nut xam. */}
            {period && !isPeriodClosed && period.hasEnded ? (
              <Button className="ml-1" onClick={() => setConfirmClose(true)}>
                <Lock aria-hidden="true" />
                {PERIOD_LABEL.closeAction}
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Trang thai ky cua thang dang xem — doc TRUOC khi tin con so ben duoi:
          ky dang mo nghia la so lieu con doi duoc. */}
      {period ? (
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge
            kind="custom"
            size="sm"
            label={
              isPeriodClosed ? PERIOD_LABEL.statusClosed : PERIOD_LABEL.statusOpen
            }
            tone={isPeriodClosed ? "neutral" : "success"}
            icon={isPeriodClosed ? Lock : CircleDot}
          />
          {isPeriodClosed && period.closedAt ? (
            <span className="num text-[13px] text-ink-muted">
              Chốt lúc {formatDateTime(period.closedAt)}
            </span>
          ) : null}
          {!isPeriodClosed && !period.hasEnded ? (
            <span className="text-[13px] text-ink-muted">
              {PERIOD_LABEL.notEndedHint}
            </span>
          ) : null}
          {/* Yeu cau con treo cua chinh thang nay: chot ky khi chung chua duoc
              xu ly la khoa so lieu truoc khi no kip dung. */}
          {!isPeriodClosed && period.pendingRequestCount > 0 ? (
            <span className="text-[13px] text-warning">
              <span className="num font-medium">
                {formatNumber(period.pendingRequestCount)}
              </span>{" "}
              {PERIOD_LABEL.pendingCountLabel} chưa xử lý
            </span>
          ) : null}
        </div>
      ) : null}

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
                today={today}
                onOpenRecord={setOpenRecordId}
              />
            </TabsContent>

            <TabsContent value="list">
              <AttendanceRecordTable
                records={visibleRecords}
                employeeById={employeeById}
                shiftNameById={shiftNameById}
                today={today}
                onOpenRecord={setOpenRecordId}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Dung lai Dialog bang chung cua 03-05 — khong dung mot ban thu hai. */}
      {/* Chot ky la MOT CHIEU (D-32b) — hop thoai noi ro dieu do, va noi ca
          so yeu cau con treo cua thang neu con. */}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={`${PERIOD_LABEL.closeConfirmTitle} ${formatMonthLabel(month)}?`}
        description={
          period && period.pendingRequestCount > 0
            ? `${PERIOD_LABEL.closeConfirmBody} Hiện còn ${formatNumber(
                period.pendingRequestCount,
              )} ${PERIOD_LABEL.pendingWarning}`
            : PERIOD_LABEL.closeConfirmBody
        }
        confirmLabel={PERIOD_LABEL.closeConfirmLabel}
        tone="destructive"
        isPending={isClosing}
        onConfirm={handleClosePeriod}
      />

      <AttendancePhotoDialog
        attendanceRecordId={openRecordId}
        onOpenChange={(open) => {
          if (!open) setOpenRecordId(null);
        }}
      />
    </div>
  );
}
