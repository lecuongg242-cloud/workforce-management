"use client";

import * as React from "react";
import { ClipboardCheck, History } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { FilterBar } from "@/components/common/filter-bar";
import { SearchInput } from "@/components/common/search-input";
import { StatusBadge } from "@/components/common/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { RequestHistory } from "@/components/requests/request-history";
import {
  ReviewDialog,
  type ReviewDialogValues,
} from "@/components/requests/review-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import {
  REQUEST_REVIEW_LABEL,
  REQUEST_STATUS_LABEL,
  REQUEST_TYPE_LABEL,
} from "@/lib/constants";
import {
  getOvertimeUsage,
  listRequests,
  previewRequestEffect,
  reviewRequest,
} from "@/lib/data/requests";
import { isOverCap, requestedOvertimeHours } from "@/lib/attendance/overtime-cap";
import { useDataStore } from "@/lib/data/store";
import {
  addDays,
  formatDate,
  formatDateTime,
  formatNumber,
  normalizeText,
} from "@/lib/format";
import { OVERTIME_CAP_LABEL } from "@/lib/constants";
import type {
  OvertimeUsage,
  RequestEffect,
  RequestStatus,
  RequestType,
  ReviewDecision,
  ReviewRequestResult,
  WorkRequest,
} from "@/lib/types/domain";

/**
 * Man hinh duyet yeu cau cua quan tri (APRV-01, APRV-02, APRV-04 — plan
 * 05-01). Truoc plan nay khong co man hinh nao de duyet: quan tri chi thay so
 * dem tren dashboard, va lien ket cua the do lai tro sang giao dien nhan vien.
 *
 * PHAM VI: chi `owner`/`admin` vao duoc khu `/admin` (D-30) — `manager` giu
 * nguyen ben ngoai o phase nay. Rang buoc that nam o `middleware.ts` +
 * `requireRole` trong Server Action; man hinh nay khong tu kiem quyen.
 *
 * MOT NUT MAU NHAN cho moi khu vuc (CLAUDE.md): "Duyet" la nut chinh, "Tu
 * choi" la nut phu — tu choi la thao tac can can nhac, khong phai thao tac
 * duoc moi.
 *
 * Danh sach cho xu ly xep NGUOI CHO LAU NHAT LEN TRUOC (server sap xep,
 * `created_at` tang dan khi loc `pending`) — man hinh khong sap lai.
 */

const STATUS_FILTERS: Array<{ value: RequestStatus; label: string }> = [
  { value: "pending", label: REQUEST_STATUS_LABEL.pending },
  { value: "approved", label: REQUEST_STATUS_LABEL.approved },
  { value: "rejected", label: REQUEST_STATUS_LABEL.rejected },
];

/** Gia tri gia cho "chua co phong ban" trong o chon. */
const NO_DEPARTMENT = "__none__";

/** Cac moc "gui trong N ngay" — so ngay tinh nguoc tu "hom nay" cua server. */
const RANGE_DAYS: Record<string, number | null> = {
  all: null,
  d7: 7,
  d30: 30,
  d90: 90,
};

function dateRange(request: WorkRequest): string {
  return request.fromDate === request.toDate
    ? formatDate(request.fromDate)
    : `${formatDate(request.fromDate)} – ${formatDate(request.toDate)}`;
}

/** Ghi chu tu dong them vao lich su khi nguoi duyet bam tiep du da vuot tran. */
function capNote(usage: OvertimeUsage | null): string | null {
  if (!usage || usage.capHours === null) return null;
  return `${OVERTIME_CAP_LABEL.noteSuffix} (đã dùng ${formatNumber(
    usage.usedHours,
  )}/${formatNumber(usage.capHours)} giờ)`;
}

/** Cau mo ta he qua cho toast; `null` khi khong co he qua nao (tu choi, tang ca). */
function describeEffect(effect: RequestEffect): string | null {
  const parts: string[] = [];
  if (effect.insertedCount > 0) {
    parts.push(`Đã tạo ${effect.insertedCount} bản ghi công`);
  }
  if (effect.updatedCount > 0) {
    parts.push(`Đã sửa ${effect.updatedCount} bản ghi công`);
  }
  if (effect.skippedCount > 0) {
    parts.push(
      `Bỏ qua ${effect.skippedCount} ngày đã có chấm công: ${effect.skippedDates
        .map(formatDate)
        .join(", ")}`,
    );
  }
  return parts.length > 0 ? `${parts.join(". ")}.` : null;
}

export function RequestsReviewView({
  today,
}: {
  /** "YYYY-MM-DD" do server cap (D-19) — moc tinh cac khoang "gui trong N ngay". */
  today: string;
}): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const [status, setStatus] = React.useState<RequestStatus | "all">("pending");
  const [reviewTarget, setReviewTarget] = React.useState<{
    request: WorkRequest;
    decision: ReviewDecision;
  } | null>(null);
  const [historyTarget, setHistoryTarget] = React.useState<WorkRequest | null>(
    null,
  );
  const [previewEffect, setPreviewEffect] = React.useState<RequestEffect | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [overtimeUsage, setOvertimeUsage] = React.useState<OvertimeUsage | null>(
    null,
  );

  const { data: requests, isLoading, error, reload } = useDataQuery(
    () => listRequests({ companyId: session.companyId, status }),
    [session.companyId, status],
  );

  /* ------------------------------------------------------------------ */
  /* Bo loc                                                              */
  /*                                                                     */
  /* Trang thai di theo TRUY VAN (API da nhan `status`, va thu tu "nguoi  */
  /* cho lau nhat len truoc" do server sap). Ba loc con lai lam tren du   */
  /* lieu da co — chung khong lam giam luong tai ve.                      */
  /* ------------------------------------------------------------------ */
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [typeFilter, setTypeFilter] = React.useState<RequestType | "all">("all");
  const [departmentFilter, setDepartmentFilter] = React.useState("all");
  const [rangeFilter, setRangeFilter] = React.useState<keyof typeof RANGE_DAYS>(
    "all",
  );

  const fetchedItems = React.useMemo(() => requests ?? [], [requests]);

  const departmentOptions = React.useMemo(() => {
    const names = new Set<string>();
    let hasNone = false;
    fetchedItems.forEach((request) => {
      if (request.departmentName) names.add(request.departmentName);
      else hasNone = true;
    });
    const options = [...names]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((name) => ({ value: name, label: name }));
    return hasNone
      ? [
          ...options,
          {
            value: NO_DEPARTMENT,
            label: REQUEST_REVIEW_LABEL.filterNoDepartment,
          },
        ]
      : options;
  }, [fetchedItems]);

  const rangeDays = RANGE_DAYS[rangeFilter];
  // `addDays` lam viec tren chuoi "YYYY-MM-DD" — eslint `timeflow/no-date-in-client`
  // cam dong ho trinh duyet o tang nay.
  const fromDate = rangeDays === null ? null : addDays(today, -rangeDays);

  const items = React.useMemo(() => {
    const keyword = normalizeText(debouncedSearch);
    return fetchedItems.filter((request) => {
      if (
        keyword !== "" &&
        !normalizeText(
          `${request.employeeName ?? ""} ${request.employeeCode ?? ""}`,
        ).includes(keyword)
      ) {
        return false;
      }
      if (typeFilter !== "all" && request.type !== typeFilter) return false;
      if (
        departmentFilter !== "all" &&
        (request.departmentName ?? NO_DEPARTMENT) !== departmentFilter
      ) {
        return false;
      }
      // `createdAt` la ISO date-time; so sanh 10 ky tu dau la so sanh ngay.
      if (fromDate !== null && request.createdAt.slice(0, 10) < fromDate) {
        return false;
      }
      return true;
    });
  }, [fetchedItems, debouncedSearch, typeFilter, departmentFilter, fromDate]);

  const hasActiveFilter =
    search.trim() !== "" ||
    status !== "pending" ||
    typeFilter !== "all" ||
    departmentFilter !== "all" ||
    rangeFilter !== "all";

  const resetFilters = (): void => {
    setSearch("");
    // Ve mac dinh cua man hinh la "Chờ duyệt", khong phai "mọi trạng thái":
    // day la danh sach VIEC PHAI LAM, khong phai kho luu tru.
    setStatus("pending");
    setTypeFilter("all");
    setDepartmentFilter("all");
    setRangeFilter("all");
  };

  /* ------------------------------------------------------------------ */
  /* Duyet / tu choi hang loat                                           */
  /*                                                                     */
  /* Ca hai quyet dinh deu lam duoc theo lo. Tu choi hang loat VAN GIU    */
  /* rang buoc ly do bat buoc cua luong don le — chi khac la ca lo dung   */
  /* CHUNG mot ly do, va cho nhap noi thang dieu do de nguoi viet biet    */
  /* cau minh go se den tay tung nguoi trong lo.                          */
  /* ------------------------------------------------------------------ */
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  /** `null` = chua mo hop thoai; khac `null` = dang xac nhan quyet dinh do. */
  const [bulkDecision, setBulkDecision] = React.useState<ReviewDecision | null>(
    null,
  );
  const [bulkReason, setBulkReason] = React.useState("");
  const [isBulkPending, setIsBulkPending] = React.useState(false);
  // So yeu cau tang ca trong lo se vuot tran — dem TRUOC khi bam, de cau
  // canh bao trong hop thoai la mot con so that chu khong phai mot loi nhac
  // chung chung.
  const [bulkOverCapCount, setBulkOverCapCount] = React.useState<number | null>(
    null,
  );

  const pendingItems = React.useMemo(
    () => items.filter((request) => request.status === "pending"),
    [items],
  );

  React.useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => pendingItems.some((request) => request.id === id)),
    );
  }, [pendingItems]);

  const selectedRequests = pendingItems.filter((request) =>
    selectedIds.includes(request.id),
  );

  const allSelected =
    pendingItems.length > 0 && selectedIds.length === pendingItems.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleOne = (id: string, checked: boolean): void => {
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  };

  const toggleAll = (checked: boolean): void => {
    setSelectedIds(checked ? pendingItems.map((request) => request.id) : []);
  };

  /**
   * Mo hop thoai xac nhan cho ca lo.
   *
   * Voi DUYET: do gio tang ca cua tung yeu cau TRUOC, vi luong duyet tung yeu
   * cau co canh bao vuot tran — neu duyet hang loat khong co, no thanh mot loi
   * lach khoi canh bao do.
   *
   * Voi TU CHOI: khong co gi de do (tu choi khong ghi ngay cong nao), nhung
   * LY DO la bat buoc y nhu tu choi tung yeu cau.
   */
  const openBulkConfirm = (decision: ReviewDecision): void => {
    setBulkOverCapCount(null);
    setBulkReason("");
    setBulkDecision(decision);

    if (decision === "rejected") {
      setBulkOverCapCount(0);
      return;
    }

    const overtimeRequests = selectedRequests.filter(
      (request) => request.type === "overtime",
    );
    if (overtimeRequests.length === 0) {
      setBulkOverCapCount(0);
      return;
    }

    Promise.all(
      overtimeRequests.map((request) =>
        getOvertimeUsage({
          employeeId: request.employeeId,
          month: request.fromDate.slice(0, 7),
          excludeRequestId: request.id,
        })
          .then((usage) =>
            isOverCap({
              usedHours: usage.usedHours,
              requestedHours: requestedOvertimeHours(
                request.fromTime,
                request.toTime,
              ),
              capHours: usage.capHours,
            }),
          )
          // Khong do duoc thi KHONG coi la "khong vuot" — tra `null` de con so
          // canh bao khong bao gio nho hon su that.
          .catch(() => null),
      ),
    ).then((flags) => {
      setBulkOverCapCount(flags.filter((flag) => flag === true).length);
    });
  };

  const handleBulkReview = async (): Promise<void> => {
    if (!bulkDecision) return;
    const decision = bulkDecision;
    const reason = bulkReason.trim();
    // Chan ngay tai day, khong chi o nut: mot lo bi tu choi khong ly do la
    // muoi nguoi khong biet phai sua gi de gui lai.
    if (decision === "rejected" && reason === "") return;

    setIsBulkPending(true);
    try {
      const results = await Promise.allSettled(
        selectedRequests.map(async (request) => {
          if (decision === "rejected") {
            return reviewRequest(request.id, { decision, note: reason });
          }

          // Vuot tran van duyet duoc, nhung phai de lai DAU VET — cung khuon
          // voi luong duyet tung yeu cau (T-05-03-03).
          let note: string | null = null;
          if (request.type === "overtime") {
            const usage = await getOvertimeUsage({
              employeeId: request.employeeId,
              month: request.fromDate.slice(0, 7),
              excludeRequestId: request.id,
            }).catch(() => null);
            const overCap =
              usage !== null &&
              isOverCap({
                usedHours: usage.usedHours,
                requestedHours: requestedOvertimeHours(
                  request.fromTime,
                  request.toTime,
                ),
                capHours: usage.capHours,
              });
            if (overCap) note = capNote(usage);
          }
          return reviewRequest(request.id, { decision, note });
        }),
      );

      const fulfilled = results.filter(
        (item): item is PromiseFulfilledResult<ReviewRequestResult> =>
          item.status === "fulfilled",
      );
      const failed = results.length - fulfilled.length;

      // Tong tac dong THAT cong tu ket qua tung yeu cau: duyet mot lo ma khong
      // biet vua ghi bao nhieu ngay cong la duyet mu.
      const effect = fulfilled.reduce<RequestEffect>(
        (sum, item) => ({
          insertedCount: sum.insertedCount + item.value.effect.insertedCount,
          updatedCount: sum.updatedCount + item.value.effect.updatedCount,
          skippedCount: sum.skippedCount + item.value.effect.skippedCount,
          skippedDates: [...sum.skippedDates, ...item.value.effect.skippedDates],
        }),
        { insertedCount: 0, updatedCount: 0, skippedCount: 0, skippedDates: [] },
      );

      const isReject = decision === "rejected";
      if (fulfilled.length === 0) {
        toast.error(
          isReject
            ? REQUEST_REVIEW_LABEL.bulkRejectError
            : REQUEST_REVIEW_LABEL.bulkError,
        );
      } else if (failed > 0) {
        toast.warning(
          (isReject
            ? REQUEST_REVIEW_LABEL.bulkRejectPartial
            : REQUEST_REVIEW_LABEL.bulkPartial
          )
            .replace("{ok}", String(fulfilled.length))
            .replace("{fail}", String(failed)),
          { description: describeEffect(effect) ?? undefined },
        );
      } else {
        toast.success(
          (isReject
            ? REQUEST_REVIEW_LABEL.bulkRejectSuccess
            : REQUEST_REVIEW_LABEL.bulkSuccess
          ).replace("{n}", String(fulfilled.length)),
          { description: describeEffect(effect) ?? undefined },
        );
      }

      setSelectedIds([]);
      setBulkDecision(null);
      setBulkReason("");
      invalidate();
      reload();
    } finally {
      setIsBulkPending(false);
    }
  };

  /**
   * Mo hop thoai xu ly. Voi quyet dinh DUYET, hoi truoc server xem tac dong se
   * la gi — con so do chi server dem duoc (ngay nao la ngay lam viec, ngay nao
   * la ngay le, ngay nao da co cham cong), giao dien khong co du lieu de suy.
   * Loi khi lay xem truoc KHONG chan viec duyet: thieu con so la mat mot tro
   * giup, khong phai mat quyen quyet dinh.
   */
  const openReview = (request: WorkRequest, decision: ReviewDecision): void => {
    setReviewTarget({ request, decision });
    setPreviewEffect(null);
    setOvertimeUsage(null);
    if (decision !== "approved") return;

    // Yeu cau tang ca khong ghi ngay cong nao (D-31) nen khong co gi de xem
    // truoc; thay vao do hoi gio tang ca da dung de biet co vuot tran khong
    // (SET-05). Yeu cau dang xet bi loai khoi phan "da dung" — no la phan
    // "yeu cau nay them", cong ca hai ve se bao vuot gap doi.
    if (request.type === "overtime") {
      getOvertimeUsage({
        employeeId: request.employeeId,
        month: request.fromDate.slice(0, 7),
        excludeRequestId: request.id,
      })
        .then(setOvertimeUsage)
        .catch(() => setOvertimeUsage(null));
      return;
    }

    setPreviewLoading(true);
    previewRequestEffect(request.id)
      .then(setPreviewEffect)
      .catch(() => setPreviewEffect(null))
      .finally(() => setPreviewLoading(false));
  };

  const handleReview = async (values: ReviewDialogValues): Promise<void> => {
    if (!reviewTarget) return;
    const { request, decision } = reviewTarget;
    try {
      // T-05-03-03: duyet khi da vuot tran phai de lai DAU VET trong lich su
      // xu ly — nguoi doc lai sau nay can biet quyet dinh do duoc dua ra khi
      // canh bao dang hien, khong phai trong im lang.
      const overCap =
        decision === "approved" &&
        request.type === "overtime" &&
        overtimeUsage !== null &&
        isOverCap({
          usedHours: overtimeUsage.usedHours,
          requestedHours: requestedOvertimeHours(request.fromTime, request.toTime),
          capHours: overtimeUsage.capHours,
        });
      const note = [values.note?.trim() || null, overCap ? capNote(overtimeUsage) : null]
        .filter(Boolean)
        .join(" — ");

      const result = await reviewRequest(request.id, {
        decision,
        note: note || null,
      });
      invalidate();
      reload();
      setReviewTarget(null);
      toast.success(
        decision === "approved"
          ? REQUEST_REVIEW_LABEL.approveSuccess
          : REQUEST_REVIEW_LABEL.rejectSuccess,
        // Toast noi RO he qua: duyet xong ma khong biet minh vua tao bao nhieu
        // ngay cong la duyet mu.
        { description: describeEffect(result.effect) ?? undefined },
      );
    } catch (cause) {
      // Thong diep tu server duoc hien NGUYEN VAN — no mang thong tin man hinh
      // khong tu biet duoc (vi du yeu cau vua bi nguoi khac xu ly xong).
      toast.error(
        cause instanceof Error ? cause.message : REQUEST_REVIEW_LABEL.saveError,
      );
      reload();
    }
  };

  const isPendingView = status === "pending";

  return (
    <div className="grid gap-6">
      <PageHeader
        title={REQUEST_REVIEW_LABEL.pageTitle}
        description={
          requests ? (
            <>
              <span className="num font-medium text-ink">
                {formatNumber(items.length)}
              </span>{" "}
              yêu cầu ở mục đang xem. {REQUEST_REVIEW_LABEL.pageDescription}
            </>
          ) : (
            "Đang tải danh sách yêu cầu…"
          )
        }
      />

      <div className="surface-card overflow-hidden">
        {/* Thanh loc van hien khi ket qua rong NEU dang co bo loc bat — neu
            khong, nguoi dung loc trung roi khong con duong nao go bo loc ra. */}
        {requests && (fetchedItems.length > 0 || hasActiveFilter) ? (
          <FilterBar
            search={
              <SearchInput
                value={search}
                onValueChange={setSearch}
                label={REQUEST_REVIEW_LABEL.searchLabel}
                placeholder={REQUEST_REVIEW_LABEL.searchPlaceholder}
              />
            }
            filters={[
              {
                id: "requests-filter-status",
                label: REQUEST_REVIEW_LABEL.filterStatusLabel,
                value: status,
                allLabel: REQUEST_REVIEW_LABEL.filterStatusAll,
                options: STATUS_FILTERS,
                onChange: (value) => setStatus(value as RequestStatus | "all"),
              },
              {
                id: "requests-filter-type",
                label: REQUEST_REVIEW_LABEL.filterTypeLabel,
                value: typeFilter,
                allLabel: REQUEST_REVIEW_LABEL.filterTypeAll,
                options: (
                  Object.keys(REQUEST_TYPE_LABEL) as RequestType[]
                ).map((type) => ({
                  value: type,
                  label: REQUEST_TYPE_LABEL[type],
                })),
                onChange: (value) => setTypeFilter(value as RequestType | "all"),
              },
              {
                id: "requests-filter-department",
                label: REQUEST_REVIEW_LABEL.filterDepartmentLabel,
                value: departmentFilter,
                allLabel: REQUEST_REVIEW_LABEL.filterDepartmentAll,
                options: departmentOptions,
                onChange: setDepartmentFilter,
              },
              {
                id: "requests-filter-range",
                label: REQUEST_REVIEW_LABEL.filterRangeLabel,
                value: rangeFilter,
                allLabel: REQUEST_REVIEW_LABEL.filterRangeAll,
                options: [
                  { value: "d7", label: REQUEST_REVIEW_LABEL.filterRange7 },
                  { value: "d30", label: REQUEST_REVIEW_LABEL.filterRange30 },
                  { value: "d90", label: REQUEST_REVIEW_LABEL.filterRange90 },
                ],
                onChange: (value) =>
                  setRangeFilter(value as keyof typeof RANGE_DAYS),
              },
            ]}
            hasActiveFilter={hasActiveFilter}
            onReset={resetFilters}
            trailing={
              <p className="num text-[13px] whitespace-nowrap text-ink-muted">
                {formatNumber(items.length)}/{formatNumber(fetchedItems.length)}{" "}
                {REQUEST_REVIEW_LABEL.filterCountSuffix}
              </p>
            }
          />
        ) : null}

        {/* Thanh duyet hang loat — chi hien khi da chon. */}
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline bg-brand-wash px-4 py-2.5">
            <p className="num text-[13px] font-medium text-brand-deep">
              {REQUEST_REVIEW_LABEL.bulkSelectedPrefix}{" "}
              {formatNumber(selectedIds.length)}{" "}
              {REQUEST_REVIEW_LABEL.bulkSelectedSuffix}
            </p>
            {/* Duyet la nut chinh, tu choi la nut phu — cung quy uoc voi hai
                nut o cuoi moi dong (CLAUDE.md: mot nut mau nhan moi khu vuc). */}
            <Button
              size="sm"
              onClick={() => openBulkConfirm("approved")}
              disabled={isBulkPending}
            >
              <ClipboardCheck aria-hidden="true" />
              {REQUEST_REVIEW_LABEL.bulkApproveAction}
            </Button>
            <Button
              size="sm"
              variant="destructive-outline"
              onClick={() => openBulkConfirm("rejected")}
              disabled={isBulkPending}
            >
              {REQUEST_REVIEW_LABEL.bulkRejectAction}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => setSelectedIds([])}
              disabled={isBulkPending}
            >
              {REQUEST_REVIEW_LABEL.bulkClear}
            </Button>
          </div>
        ) : null}

        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading ? (
          <DataTableSkeleton rows={5} columns={6} />
        ) : items.length === 0 && hasActiveFilter ? (
          // Loc khong ra gi KHAC voi "moi yeu cau da xu ly xong": mot ben la
          // bo loc qua chat, ben kia la tin tot. Noi nham thi nguoi duyet yen
          // tam trong khi hang cho van con.
          <EmptyState
            icon={ClipboardCheck}
            title={REQUEST_REVIEW_LABEL.filteredEmptyTitle}
            description={REQUEST_REVIEW_LABEL.filteredEmptyBody}
            action={
              <Button variant="outline" onClick={resetFilters}>
                Xóa bộ lọc
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            // Khong co yeu cau nao cho xu ly la TIN TOT, khong phai mot man
            // hinh hong — chu phai noi dung dieu do.
            title={
              isPendingView
                ? REQUEST_REVIEW_LABEL.emptyPendingTitle
                : REQUEST_REVIEW_LABEL.emptyFilteredTitle
            }
            description={
              isPendingView
                ? REQUEST_REVIEW_LABEL.emptyPendingBody
                : REQUEST_REVIEW_LABEL.emptyFilteredBody
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pr-0">
                    <Checkbox
                      aria-label={REQUEST_REVIEW_LABEL.selectAllLabel}
                      // Khong con yeu cau nao cho duyet thi khong co gi de chon.
                      disabled={pendingItems.length === 0 || isBulkPending}
                      checked={
                        allSelected
                          ? true
                          : someSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                    />
                  </TableHead>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Loại yêu cầu</TableHead>
                  <TableHead>Khoảng ngày</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Gửi lúc</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((request) => (
                  <TableRow
                    key={request.id}
                    data-state={
                      selectedIds.includes(request.id) ? "selected" : undefined
                    }
                  >
                    <TableCell className="pr-0">
                      <Checkbox
                        aria-label={`${REQUEST_REVIEW_LABEL.selectRowPrefix} ${
                          request.employeeName ?? request.employeeId
                        }`}
                        // Yeu cau da xu ly khong con gi de duyet.
                        disabled={request.status !== "pending" || isBulkPending}
                        checked={selectedIds.includes(request.id)}
                        onCheckedChange={(checked) =>
                          toggleOne(request.id, checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-ink">
                        {/* Thieu ngu canh -> lui ve dinh danh, khong bo trong:
                            nguoi duyet van phai biet dong nay la cua ai. */}
                        {request.employeeName ?? request.employeeId}
                      </div>
                      <div className="text-xs text-ink-muted">
                        {[request.employeeCode, request.departmentName]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-ink-secondary">
                      {REQUEST_TYPE_LABEL[request.type]}
                    </TableCell>
                    <TableCell className="num whitespace-nowrap text-ink-secondary">
                      {dateRange(request)}
                    </TableCell>
                    <TableCell className="max-w-[22rem] text-ink-secondary">
                      {request.reason}
                    </TableCell>
                    <TableCell className="num whitespace-nowrap text-xs text-ink-muted">
                      {formatDateTime(request.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="request" value={request.status} size="sm" />
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => openReview(request, "approved")}
                          >
                            {REQUEST_REVIEW_LABEL.approveAction}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive-outline"
                            onClick={() => openReview(request, "rejected")}
                          >
                            {REQUEST_REVIEW_LABEL.rejectAction}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setHistoryTarget(request)}
                        >
                          <History aria-hidden="true" />
                          {REQUEST_REVIEW_LABEL.historyAction}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Xac nhan hang loat. DUYET noi truoc ba dieu: se ghi that vao bang
          cong, khong co bang xem truoc tung yeu cau, va bao nhieu yeu cau tang
          ca dang vuot tran. TU CHOI doi hoi mot ly do dung chung cho ca lo. */}
      <ConfirmDialog
        open={bulkDecision !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBulkDecision(null);
            setBulkOverCapCount(null);
            setBulkReason("");
          }
        }}
        title={(bulkDecision === "rejected"
          ? REQUEST_REVIEW_LABEL.bulkRejectDialogTitle
          : REQUEST_REVIEW_LABEL.bulkDialogTitle
        ).replace("{n}", String(selectedIds.length))}
        description={
          bulkDecision === "rejected" ? (
            <div className="grid gap-3">
              <p>{REQUEST_REVIEW_LABEL.bulkRejectDialogBody}</p>
              <div className="grid gap-1.5">
                <label
                  htmlFor="requests-bulk-reason"
                  className="text-[13px] font-medium text-ink-secondary"
                >
                  {REQUEST_REVIEW_LABEL.bulkReasonLabel}
                  <span className="text-danger" aria-hidden="true">
                    *
                  </span>
                </label>
                <Textarea
                  id="requests-bulk-reason"
                  rows={3}
                  value={bulkReason}
                  placeholder={REQUEST_REVIEW_LABEL.bulkReasonPlaceholder}
                  onChange={(event) => setBulkReason(event.target.value)}
                />
                {/* Mot ly do dung chung chi dung khi no dung voi TUNG nguoi —
                    cau nay nhac dieu do ngay truoc khi go. */}
                <p className="text-xs text-ink-muted">
                  {REQUEST_REVIEW_LABEL.bulkReasonRequired}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <p>{REQUEST_REVIEW_LABEL.bulkDialogBody}</p>
              {bulkOverCapCount !== null && bulkOverCapCount > 0 ? (
                <p className="text-warning">
                  {REQUEST_REVIEW_LABEL.bulkOverCapWarning.replace(
                    "{n}",
                    String(bulkOverCapCount),
                  )}
                </p>
              ) : null}
            </div>
          )
        }
        confirmLabel={
          bulkDecision === "rejected"
            ? REQUEST_REVIEW_LABEL.bulkRejectConfirm
            : REQUEST_REVIEW_LABEL.bulkConfirm
        }
        tone={bulkDecision === "rejected" ? "destructive" : undefined}
        // Chan ngay tai nut: (a) tu choi chua co ly do, (b) duyet ma con so
        // canh bao vuot tran chua kip hien — bam truoc khi doc la duyet mu.
        isPending={
          isBulkPending ||
          (bulkDecision === "rejected"
            ? bulkReason.trim().length === 0
            : bulkOverCapCount === null)
        }
        onConfirm={handleBulkReview}
      />

      <ReviewDialog
        open={reviewTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewTarget(null);
            setPreviewEffect(null);
            setOvertimeUsage(null);
          }
        }}
        request={reviewTarget?.request ?? null}
        decision={reviewTarget?.decision ?? "approved"}
        effect={previewEffect}
        effectLoading={previewLoading}
        overtimeUsage={overtimeUsage}
        onSubmit={handleReview}
      />

      <Dialog
        open={historyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{REQUEST_REVIEW_LABEL.historyAction}</DialogTitle>
            <DialogDescription>
              {historyTarget
                ? `${REQUEST_TYPE_LABEL[historyTarget.type]} · ${
                    historyTarget.employeeName ?? historyTarget.employeeId
                  } · ${dateRange(historyTarget)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {historyTarget ? <RequestHistory requestId={historyTarget.id} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
