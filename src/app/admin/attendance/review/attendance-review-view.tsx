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

import { toast } from "sonner";

import { AttendancePhotoDialog } from "@/components/attendance/attendance-photo-dialog";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FilterBar } from "@/components/common/filter-bar";
import { SearchInput } from "@/components/common/search-input";
import { StatusBadge } from "@/components/common/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataQuery } from "@/hooks/use-data-query";
import { useDebounce } from "@/hooks/use-debounce";
import { listAttendanceReview } from "@/lib/data/attendance-review";
import { markPhotoReviewed } from "@/lib/data/attendance-photos";
import { useDataStore } from "@/lib/data/store";
import {
  ATTENDANCE_REVIEW_LABEL,
  DEFAULT_TIMEZONE,
  PHOTO_REVIEW_STATUS_LABEL,
  PHOTO_REVIEW_STATUS_TONE,
} from "@/lib/constants";
import { addDays, formatNumber, normalizeText } from "@/lib/format";
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

/** Gia tri gia cho "khong gan diem lam viec" trong o chon. */
const NO_SITE = "__none__";

/** Cac moc thoi gian dung san — so ngay tinh nguoc tu "hom nay" cua server. */
const RANGE_DAYS: Record<string, number | null> = {
  all: null,
  d7: 7,
  d30: 30,
  d90: 90,
};

export function AttendanceReviewView({
  today,
}: {
  /** "YYYY-MM-DD" do server cap (D-19) — moc tinh cac khoang "N ngay qua". */
  today: string;
}): React.ReactElement {
  const [openRecordId, setOpenRecordId] = React.useState<string | null>(null);
  const { invalidate } = useDataStore();

  /* ------------------------------------------------------------------ */
  /* Bo loc                                                              */
  /*                                                                     */
  /* Hai loc di theo TRUY VAN (`reviewStatus`, khoang thoi gian) vi API  */
  /* da nhan chung — loc o server thi khong keo ve trinh duyet nhung dong */
  /* khong ai nhin. Ba loc con lai (tim ten, dau hieu, diem lam viec) lam */
  /* tren du lieu da co: chung khong lam giam luong tai ve.               */
  /* ------------------------------------------------------------------ */
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [statusFilter, setStatusFilter] = React.useState<
    PhotoReviewStatus | "all"
  >("all");
  const [reasonFilter, setReasonFilter] = React.useState<
    "all" | "far_from_site" | "outside_shift"
  >("all");
  const [siteFilter, setSiteFilter] = React.useState("all");
  const [rangeFilter, setRangeFilter] = React.useState<keyof typeof RANGE_DAYS>(
    "all",
  );

  const rangeDays = RANGE_DAYS[rangeFilter];
  // `addDays` lam viec tren chuoi "YYYY-MM-DD", khong dung `new Date()` —
  // eslint `timeflow/no-date-in-client` cam dong ho trinh duyet o tang nay.
  const from = rangeDays === null ? undefined : addDays(today, -rangeDays);

  const { data: items, isLoading, error, reload } = useDataQuery(
    () =>
      listAttendanceReview({
        from,
        reviewStatus: statusFilter === "all" ? undefined : statusFilter,
      }),
    [from, statusFilter],
  );

  // Toan bo dong TRA VE tu truy van (da qua hai loc o server).
  const fetchedRows = React.useMemo(() => items ?? [], [items]);

  const siteOptions = React.useMemo(() => {
    const names = new Set<string>();
    let hasNone = false;
    fetchedRows.forEach((item) => {
      const name = item.workSiteName ?? item.shiftWindow;
      if (name) names.add(name);
      else hasNone = true;
    });
    const options = [...names]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((name) => ({ value: name, label: name }));
    return hasNone
      ? [
          ...options,
          {
            value: NO_SITE,
            label: ATTENDANCE_REVIEW_LABEL.filterSiteNone,
          },
        ]
      : options;
  }, [fetchedRows]);

  const rows = React.useMemo(() => {
    const keyword = normalizeText(debouncedSearch);
    return fetchedRows.filter((item) => {
      if (keyword !== "" && !normalizeText(item.employeeName).includes(keyword)) {
        return false;
      }
      if (reasonFilter !== "all" && item.reason !== reasonFilter) return false;
      if (siteFilter !== "all") {
        const name = item.workSiteName ?? item.shiftWindow ?? NO_SITE;
        if (name !== siteFilter) return false;
      }
      return true;
    });
  }, [fetchedRows, debouncedSearch, reasonFilter, siteFilter]);

  const hasActiveFilter =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    reasonFilter !== "all" ||
    siteFilter !== "all" ||
    rangeFilter !== "all";

  const resetFilters = (): void => {
    setSearch("");
    setStatusFilter("all");
    setReasonFilter("all");
    setSiteFilter("all");
    setRangeFilter("all");
  };

  /* ------------------------------------------------------------------ */
  /* Duyet hang loat                                                     */
  /*                                                                     */
  /* Phan lon viec o man hinh nay la XAC NHAN CHUYEN BINH THUONG: GPS do */
  /* lech vai chuc met trong nha xuong, ca dem cham sat gio. Bat nguoi   */
  /* dung mo tung hop thoai cho nhung ca do la bat ho tra gia cho mot    */
  /* thao tac ma ket qua da biet truoc. Hop thoai van con nguyen cho ca  */
  /* nao that su phai nhin anh.                                          */
  /* ------------------------------------------------------------------ */
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isBulkPending, setIsBulkPending] = React.useState(false);

  // Dong DA xem xet thi khong con gi de lam — khong cho chon, de "chon tat ca"
  // khong bao gio gui lai mot thao tac rong.
  const pendingRows = React.useMemo(
    () => rows.filter((item) => item.reviewStatus === "pending"),
    [rows],
  );

  // Danh sach tai lai sau moi lan duyet, nen bo chon nhung dong khong con nua.
  React.useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => pendingRows.some((item) => item.photoId === id)),
    );
  }, [pendingRows]);

  const allSelected =
    pendingRows.length > 0 && selectedIds.length === pendingRows.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleOne = (photoId: string, checked: boolean): void => {
    setSelectedIds((current) =>
      checked
        ? [...current, photoId]
        : current.filter((id) => id !== photoId),
    );
  };

  const toggleAll = (checked: boolean): void => {
    setSelectedIds(checked ? pendingRows.map((item) => item.photoId) : []);
  };

  const handleBulkReview = async (): Promise<void> => {
    setIsBulkPending(true);
    try {
      // `allSettled`, khong phai `all`: mot anh hong khong duoc lam do cong
      // viec cua 19 anh con lai, va con so that phai duoc noi ra.
      const results = await Promise.allSettled(
        selectedIds.map((photoId) => markPhotoReviewed(photoId, "approved")),
      );
      const failed = results.filter((item) => item.status === "rejected").length;
      const ok = results.length - failed;

      if (ok === 0) {
        toast.error(ATTENDANCE_REVIEW_LABEL.bulkError);
      } else if (failed > 0) {
        toast.warning(
          ATTENDANCE_REVIEW_LABEL.bulkPartial
            .replace("{ok}", String(ok))
            .replace("{fail}", String(failed)),
        );
      } else {
        toast.success(
          ATTENDANCE_REVIEW_LABEL.bulkSuccess.replace("{n}", String(ok)),
        );
      }

      setSelectedIds([]);
      invalidate();
      reload();
    } finally {
      setIsBulkPending(false);
    }
  };

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
        {/* Thanh loc van hien khi ket qua rong NEU dang co bo loc bat — neu
            khong, nguoi dung loc trung roi khong con duong nao go bo loc ra. */}
        {items && (fetchedRows.length > 0 || hasActiveFilter) ? (
          <FilterBar
            search={
              <SearchInput
                value={search}
                onValueChange={setSearch}
                label={ATTENDANCE_REVIEW_LABEL.searchLabel}
                placeholder={ATTENDANCE_REVIEW_LABEL.searchPlaceholder}
              />
            }
            filters={[
              {
                id: "review-filter-status",
                label: ATTENDANCE_REVIEW_LABEL.filterStatusLabel,
                value: statusFilter,
                allLabel: ATTENDANCE_REVIEW_LABEL.filterStatusAll,
                options: (
                  ["pending", "approved", "rejected"] as PhotoReviewStatus[]
                ).map((status) => ({
                  value: status,
                  label: PHOTO_REVIEW_STATUS_LABEL[status],
                })),
                onChange: (value) =>
                  setStatusFilter(value as PhotoReviewStatus | "all"),
              },
              {
                id: "review-filter-reason",
                label: ATTENDANCE_REVIEW_LABEL.filterReasonLabel,
                value: reasonFilter,
                allLabel: ATTENDANCE_REVIEW_LABEL.filterReasonAll,
                // Hai dau hieu nay doi hoi hai cach kiem tra khac han nhau —
                // mot ben la di xac minh vi tri, mot ben la doi chieu lich ca —
                // nen tach chung ra la tach hai luong cong viec.
                options: [
                  {
                    value: "far_from_site",
                    label: ATTENDANCE_REVIEW_LABEL.filterReasonFarFromSite,
                  },
                  {
                    value: "outside_shift",
                    label: ATTENDANCE_REVIEW_LABEL.filterReasonOutsideShift,
                  },
                ],
                onChange: (value) =>
                  setReasonFilter(
                    value as "all" | "far_from_site" | "outside_shift",
                  ),
              },
              {
                id: "review-filter-site",
                label: ATTENDANCE_REVIEW_LABEL.filterSiteLabel,
                value: siteFilter,
                allLabel: ATTENDANCE_REVIEW_LABEL.filterSiteAll,
                options: siteOptions,
                onChange: setSiteFilter,
              },
              {
                id: "review-filter-range",
                label: ATTENDANCE_REVIEW_LABEL.filterRangeLabel,
                value: rangeFilter,
                allLabel: ATTENDANCE_REVIEW_LABEL.filterRangeAll,
                options: [
                  { value: "d7", label: ATTENDANCE_REVIEW_LABEL.filterRange7 },
                  { value: "d30", label: ATTENDANCE_REVIEW_LABEL.filterRange30 },
                  { value: "d90", label: ATTENDANCE_REVIEW_LABEL.filterRange90 },
                ],
                onChange: (value) =>
                  setRangeFilter(value as keyof typeof RANGE_DAYS),
              },
            ]}
            hasActiveFilter={hasActiveFilter}
            onReset={resetFilters}
            trailing={
              <p className="num text-[13px] whitespace-nowrap text-ink-muted">
                {formatNumber(rows.length)}/{formatNumber(fetchedRows.length)}{" "}
                {ATTENDANCE_REVIEW_LABEL.filterCountSuffix}
              </p>
            }
          />
        ) : null}

        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading ? (
          <DataTableSkeleton rows={6} columns={6} />
        ) : rows.length === 0 && hasActiveFilter ? (
          // Loc khong ra gi KHAC voi "khong co gi de xem lai": mot ben la bo
          // loc qua chat, ben kia la tin mung. Noi nham thi nguoi dung yen tam
          // trong khi danh sach that su van con day.
          <EmptyState
            icon={ShieldAlert}
            title={ATTENDANCE_REVIEW_LABEL.filteredEmptyTitle}
            description={ATTENDANCE_REVIEW_LABEL.filteredEmptyBody}
            action={
              <Button variant="outline" onClick={resetFilters}>
                Xóa bộ lọc
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title={ATTENDANCE_REVIEW_LABEL.emptyTitle}
            description={ATTENDANCE_REVIEW_LABEL.emptyBody}
          />
        ) : (
          <>
            {/* Thanh hanh dong hang loat — chi hien khi da chon, va no la
                cho DUY NHAT nhac lai pham vi cua dau "da xem xet" truoc khi
                nguoi dung ap no cho hang chuc ban ghi mot luc. */}
            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 border-b border-hairline bg-brand-wash px-4 py-2.5">
                <p className="num text-[13px] font-medium text-brand-deep">
                  {ATTENDANCE_REVIEW_LABEL.bulkSelectedPrefix}{" "}
                  {formatNumber(selectedIds.length)}{" "}
                  {ATTENDANCE_REVIEW_LABEL.bulkSelectedSuffix}
                </p>
                <Button
                  size="sm"
                  onClick={handleBulkReview}
                  disabled={isBulkPending}
                >
                  <CheckCircle2 aria-hidden="true" />
                  {ATTENDANCE_REVIEW_LABEL.reviewAction}
                </Button>
                <p className="text-xs text-ink-muted">
                  {ATTENDANCE_REVIEW_LABEL.bulkHint}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setSelectedIds([])}
                  disabled={isBulkPending}
                >
                  {ATTENDANCE_REVIEW_LABEL.bulkClear}
                </Button>
              </div>
            ) : null}

            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pr-0">
                  <Checkbox
                    aria-label={ATTENDANCE_REVIEW_LABEL.selectAllLabel}
                    // Khong con dong nao chua xem xet thi khong co gi de chon.
                    disabled={pendingRows.length === 0 || isBulkPending}
                    checked={
                      allSelected ? true : someSelected ? "indeterminate" : false
                    }
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                </TableHead>
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
                const isPending = item.reviewStatus === "pending";
                const isSelected = selectedIds.includes(item.photoId);
                return (
                  <TableRow
                    key={item.photoId}
                    data-state={isSelected ? "selected" : undefined}
                  >
                    <TableCell className="pr-0">
                      <Checkbox
                        aria-label={`${ATTENDANCE_REVIEW_LABEL.selectRowPrefix} ${item.employeeName}`}
                        title={
                          isPending
                            ? undefined
                            : ATTENDANCE_REVIEW_LABEL.reviewedRowHint
                        }
                        disabled={!isPending || isBulkPending}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleOne(item.photoId, checked === true)
                        }
                      />
                    </TableCell>
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
          </>
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
