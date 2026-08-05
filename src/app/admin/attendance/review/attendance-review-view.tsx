"use client";

import * as React from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPinOff,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AttendancePhotoDialog } from "@/components/attendance/attendance-photo-dialog";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { StatusBadge } from "@/components/common/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataQuery } from "@/hooks/use-data-query";
import { listAttendanceReview } from "@/lib/data/attendance-review";
import {
  ATTENDANCE_REVIEW_LABEL,
  DEFAULT_TIMEZONE,
  PHOTO_REVIEW_STATUS_LABEL,
  PHOTO_REVIEW_STATUS_TONE,
} from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { PhotoReviewStatus } from "@/lib/types/domain";

/**
 * Man hinh danh sach "can xem lai" cua quan tri (D-21/ATT-07,
 * 03-06-PLAN.md Task 3) — LOP PHAT HIEN CHINH cua toan phase sau D-20
 * (GPS khong con chan duoc ai, no chi con lam chung). Danh sach RONG o day
 * la mot trang thai LANH MANH (moi lan cham cong gan bang kinh), khong phai
 * mot ngo cut — UI-SPEC §"Empty — needs-review list".
 *
 * Hanh dong "Xem chi tiet" mo CHINH `AttendancePhotoDialog` cua plan 03-05,
 * khong dung mot Dialog thu hai (03-06-PLAN.md key_links).
 */

const reviewStatusIcon: Record<PhotoReviewStatus, LucideIcon> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

const capturedAtFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: DEFAULT_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatCapturedAt(isoDateTime: string): string {
  return capturedAtFormatter.format(new Date(isoDateTime));
}

export function AttendanceReviewView(): React.ReactElement {
  const [openRecordId, setOpenRecordId] = React.useState<string | null>(null);

  const { data: items, isLoading, error, reload } = useDataQuery(
    () => listAttendanceReview(),
    [],
  );

  const rows = items ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title={ATTENDANCE_REVIEW_LABEL.pageTitle}
        description={
          items ? (
            <>
              {ATTENDANCE_REVIEW_LABEL.pageDescriptionPrefix}{" "}
              <span className="num font-medium text-ink">
                {formatNumber(rows.length)}
              </span>{" "}
              {ATTENDANCE_REVIEW_LABEL.pageDescriptionSuffix}
            </>
          ) : (
            "Đang tải danh sách…"
          )
        }
      />

      <section className="surface-card overflow-hidden">
        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading ? (
          <DataTableSkeleton rows={6} columns={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title={ATTENDANCE_REVIEW_LABEL.emptyTitle}
            description={ATTENDANCE_REVIEW_LABEL.emptyBody}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ATTENDANCE_REVIEW_LABEL.employeeColumn}</TableHead>
                <TableHead>{ATTENDANCE_REVIEW_LABEL.workSiteColumn}</TableHead>
                <TableHead>{ATTENDANCE_REVIEW_LABEL.distanceColumn}</TableHead>
                <TableHead>{ATTENDANCE_REVIEW_LABEL.capturedAtColumn}</TableHead>
                <TableHead>{ATTENDANCE_REVIEW_LABEL.reviewStatusColumn}</TableHead>
                <TableHead className="text-right">
                  {ATTENDANCE_REVIEW_LABEL.actionColumn}
                </TableHead>
              </TableRow>
            </TableHeader>
            {/* Mot ket qua va nhieu ket qua dung CHUNG mau dong nay — khong co
                bo cuc rieng cho truong hop dung mot (UI-SPEC §"Zero/one/many"). */}
            <TableBody>
              {rows.map((item) => {
                const ReviewIcon = reviewStatusIcon[item.reviewStatus];
                return (
                  <TableRow key={item.photoId}>
                    <TableCell className="font-medium text-ink">
                      {item.employeeName}
                    </TableCell>
                    <TableCell
                      className="max-w-[200px] truncate"
                      title={item.workSiteName ?? item.shiftWindow ?? undefined}
                    >
                      {item.workSiteName ?? item.shiftWindow ?? "—"}
                    </TableCell>
                    <TableCell>
                      {/* Hai ly do, hai cach doc khac han nhau — khong gop
                          chung mot dinh dang. */}
                      {item.reason === "far_from_site" &&
                      item.distanceMeters !== null ? (
                        <>
                          {/* Khoang cach LUON di kem boi so VA do chinh xac —
                              khong bao gio de mot con so khoang cach dung mot
                              minh trong bang nay, vi nguoi doc can phan biet
                              duoc "GPS do sai" voi "dung xa that" (D-20). */}
                          <p className="num flex items-center gap-1.5 font-semibold text-warning">
                            <MapPinOff aria-hidden="true" className="size-3.5 shrink-0" />
                            {formatNumber(Math.round(item.distanceMeters))} m ·{" "}
                            {ATTENDANCE_REVIEW_LABEL.multiplierPrefix} {item.multiplier}{" "}
                            {ATTENDANCE_REVIEW_LABEL.multiplierSuffix}
                          </p>
                          {item.accuracyMeters !== null ? (
                            <p className="num mt-0.5 text-xs text-ink-muted">
                              {ATTENDANCE_REVIEW_LABEL.accuracyPrefix}:{" "}
                              {formatNumber(Math.round(item.accuracyMeters))} m
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <p className="flex items-center gap-1.5 font-semibold text-warning">
                            <CalendarClock aria-hidden="true" className="size-3.5 shrink-0" />
                            {ATTENDANCE_REVIEW_LABEL.outsideShiftLabel}
                          </p>
                          {item.punchTime ? (
                            <p className="num mt-0.5 text-xs text-ink-muted">
                              {ATTENDANCE_REVIEW_LABEL.punchTimePrefix}: {item.punchTime}
                            </p>
                          ) : null}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="num">
                      {formatCapturedAt(item.capturedAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        kind="custom"
                        label={PHOTO_REVIEW_STATUS_LABEL[item.reviewStatus]}
                        tone={PHOTO_REVIEW_STATUS_TONE[item.reviewStatus]}
                        icon={ReviewIcon}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenRecordId(item.attendanceRecordId)}
                      >
                        {ATTENDANCE_REVIEW_LABEL.detailAction}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <AttendancePhotoDialog
        attendanceRecordId={openRecordId}
        onOpenChange={(open) => {
          if (!open) setOpenRecordId(null);
        }}
      />
    </div>
  );
}
