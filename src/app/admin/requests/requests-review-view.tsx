"use client";

import * as React from "react";
import { ClipboardCheck, History } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { RequestHistory } from "@/components/requests/request-history";
import {
  ReviewDialog,
  type ReviewDialogValues,
} from "@/components/requests/review-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { OVERTIME_CAP_LABEL } from "@/lib/constants";
import type {
  OvertimeUsage,
  RequestEffect,
  RequestStatus,
  ReviewDecision,
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

const STATUS_FILTERS: Array<{ value: RequestStatus | "all"; label: string }> = [
  { value: "pending", label: REQUEST_STATUS_LABEL.pending },
  { value: "approved", label: REQUEST_STATUS_LABEL.approved },
  { value: "rejected", label: REQUEST_STATUS_LABEL.rejected },
  { value: "all", label: "Tất cả" },
];

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

export function RequestsReviewView(): React.ReactElement {
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

  const items = requests ?? [];
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
        actions={
          <div className="min-w-[180px]">
            <label htmlFor="requests-status-filter" className="sr-only">
              Lọc theo trạng thái
            </label>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as RequestStatus | "all")
              }
            >
              <SelectTrigger id="requests-status-filter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="surface-card overflow-hidden">
        {error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : isLoading ? (
          <DataTableSkeleton rows={5} columns={6} />
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
                  <TableRow key={request.id}>
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
