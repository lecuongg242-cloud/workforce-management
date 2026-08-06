"use client";

import * as React from "react";
import { CalendarOff, Plus } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import {
  HolidayDialog,
  type HolidayFormValues,
} from "@/components/settings/holiday-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { SETTINGS_HOLIDAY_LABEL } from "@/lib/constants";
import {
  countAffectedAttendance,
  createHoliday,
  deleteHoliday,
  listHolidays,
  updateHoliday,
} from "@/lib/data/holidays";
import { useDataStore } from "@/lib/data/store";
import { formatDate, formatNumber } from "@/lib/format";
import type { Holiday } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/**
 * Tab "Ngay le" cua `/admin/settings` (SET-02, plan 04-03).
 *
 * Doanh nghiep bat dau tu MOT TRANG TRANG: khong ngay le nao duoc cai san o
 * bat ky tang nao (D-26) — trang thai rong o day noi dung su that do, khong
 * trinh bay nhu mot loi.
 *
 * Cham vao QUA KHU (sua/xoa mot ngay da qua) di qua mot buoc xac nhan mang
 * CON SO THAT do server dem: ngay le khong phien ban hoa duoc theo
 * `effective_from` nhu he so tang ca, nen day la lop bao ve duy nhat cho tieu
 * chi 4 cua phase (D-25b).
 *
 * "Hom nay" den tu PROP (Server Component `page.tsx` goi `getServerToday()`),
 * khong bao gio tu `new Date()` — rule ESLint `timeflow/no-date-in-client`
 * cuong che dieu nay tren toan `src/`.
 */
export function HolidaysTab({ today }: { today: string }): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = React.useState(currentYear);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Holiday | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Holiday | null>(null);
  const [pendingWrite, setPendingWrite] = React.useState<{
    values: HolidayFormValues;
    affected: number;
  } | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const { data: holidays, isLoading, error, reload } = useDataQuery(
    () => listHolidays(year),
    [session.companyId, year],
  );

  const yearOptions = React.useMemo(() => {
    // Ba nam truoc va mot nam sau — du de khai lich nghi nam toi va sua lai
    // nam cu, khong dai toi muc thanh mot danh sach phai cuon.
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
  }, [currentYear]);

  /** Ngay da qua so voi NGAY SERVER, khong so voi dong ho trinh duyet. */
  const isPast = (date: string): boolean => date < today;

  async function persist(values: HolidayFormValues): Promise<void> {
    setIsPending(true);
    try {
      if (editing) {
        await updateHoliday(editing.id, values);
        toast.success(SETTINGS_HOLIDAY_LABEL.updateSuccess);
      } else {
        await createHoliday(values);
        toast.success(SETTINGS_HOLIDAY_LABEL.createSuccess);
      }
      invalidate();
      reload();
      setDialogOpen(false);
      setEditing(null);
      setPendingWrite(null);
      // Nam cua ngay vua khai co the khac nam dang xem — chuyen theo de nguoi
      // dung thay ngay ket qua thao tac cua minh thay vi mot danh sach khong
      // doi gi.
      setYear(Number(values.date.slice(0, 4)));
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : SETTINGS_HOLIDAY_LABEL.saveError,
      );
    } finally {
      setIsPending(false);
    }
  }

  const handleSubmit = async (values: HolidayFormValues): Promise<void> => {
    // Cham vao qua khu (ngay moi HOAC ngay cu deu tinh) thi hoi truoc — nhung
    // chi hoi khi thuc su co ban ghi bi anh huong, khong hoi thua.
    const datesToCheck = [values.date, editing?.date].filter(
      (date): date is string => Boolean(date) && isPast(date as string),
    );
    if (datesToCheck.length > 0) {
      try {
        const counts = await Promise.all(
          Array.from(new Set(datesToCheck)).map((date) =>
            countAffectedAttendance(date),
          ),
        );
        const affected = counts.reduce((sum, count) => sum + count, 0);
        if (affected > 0) {
          setPendingWrite({ values, affected });
          return;
        }
      } catch (cause) {
        toast.error(
          cause instanceof Error ? cause.message : SETTINGS_HOLIDAY_LABEL.countError,
        );
        return;
      }
    }
    await persist(values);
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setIsPending(true);
    try {
      await deleteHoliday(deleteTarget.id);
      toast.success(SETTINGS_HOLIDAY_LABEL.deleteSuccess);
      invalidate();
      reload();
      setDeleteTarget(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : SETTINGS_HOLIDAY_LABEL.deleteError,
      );
    } finally {
      setIsPending(false);
    }
  };

  const [deleteAffected, setDeleteAffected] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!deleteTarget || !isPast(deleteTarget.date)) {
      setDeleteAffected(null);
      return;
    }
    let cancelled = false;
    countAffectedAttendance(deleteTarget.date)
      .then((count) => {
        if (!cancelled) setDeleteAffected(count);
      })
      .catch(() => {
        if (!cancelled) setDeleteAffected(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteTarget]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">
            {SETTINGS_HOLIDAY_LABEL.sectionTitle}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {SETTINGS_HOLIDAY_LABEL.sectionDescription}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Select
            value={String(year)}
            onValueChange={(value) => setYear(Number(value))}
          >
            <SelectTrigger className="w-[120px]" aria-label={SETTINGS_HOLIDAY_LABEL.yearLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            {SETTINGS_HOLIDAY_LABEL.addButton}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : (holidays ?? []).length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title={SETTINGS_HOLIDAY_LABEL.emptyTitle}
          description={SETTINGS_HOLIDAY_LABEL.emptyBody}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{SETTINGS_HOLIDAY_LABEL.columnDate}</TableHead>
                <TableHead>{SETTINGS_HOLIDAY_LABEL.columnName}</TableHead>
                <TableHead className="text-right">
                  {SETTINGS_HOLIDAY_LABEL.columnAction}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(holidays ?? []).map((holiday) => (
                <TableRow key={holiday.id}>
                  <TableCell>
                    <span
                      className={cn("num", isPast(holiday.date) && "text-ink-muted")}
                    >
                      {formatDate(holiday.date)}
                    </span>
                    {/* Ngay da qua phan biet bang NHAN CHU, khong bang mau
                        don thuan (UI-SPEC: status never color-only). */}
                    {isPast(holiday.date) ? (
                      <span className="ml-2 text-xs text-ink-muted">
                        {SETTINGS_HOLIDAY_LABEL.pastTag}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="truncate" title={holiday.name}>
                    {holiday.name}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(holiday);
                          setDialogOpen(true);
                        }}
                      >
                        {SETTINGS_HOLIDAY_LABEL.editAction}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(holiday)}
                      >
                        {SETTINGS_HOLIDAY_LABEL.deleteAction}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <HolidayDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setPendingWrite(null);
          }
        }}
        holiday={editing}
        defaultDate={today}
        onSubmit={handleSubmit}
      />

      {/* Xac nhan khi thao tac cham vao QUA KHU va thuc su co ban ghi bi anh
          huong — con so do server dem, khong uoc luong o client (D-25b). */}
      <ConfirmDialog
        open={pendingWrite !== null}
        onOpenChange={(open) => {
          if (!open) setPendingWrite(null);
        }}
        title={SETTINGS_HOLIDAY_LABEL.pastConfirmTitle}
        description={
          pendingWrite ? (
            <>
              {SETTINGS_HOLIDAY_LABEL.pastConfirmBodyPrefix}{" "}
              <span className="num font-medium text-ink">
                {formatNumber(pendingWrite.affected)}
              </span>{" "}
              {SETTINGS_HOLIDAY_LABEL.pastConfirmBodySuffix}
            </>
          ) : null
        }
        confirmLabel={SETTINGS_HOLIDAY_LABEL.pastConfirmAction}
        isPending={isPending}
        onConfirm={() => {
          if (pendingWrite) void persist(pendingWrite.values);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`${SETTINGS_HOLIDAY_LABEL.deleteConfirmTitle} ${deleteTarget?.name ?? ""}?`}
        description={
          deleteAffected && deleteAffected > 0 ? (
            <>
              {SETTINGS_HOLIDAY_LABEL.pastConfirmBodyPrefix}{" "}
              <span className="num font-medium text-ink">
                {formatNumber(deleteAffected)}
              </span>{" "}
              {SETTINGS_HOLIDAY_LABEL.pastConfirmBodySuffix}
            </>
          ) : (
            SETTINGS_HOLIDAY_LABEL.deleteConfirmBody
          )
        }
        confirmLabel={SETTINGS_HOLIDAY_LABEL.deleteAction}
        tone="destructive"
        isPending={isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
