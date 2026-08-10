"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  PlatformActionDialog,
  type PlatformActionKind,
} from "@/app/platform/platform-actions-dialog";
import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDataQuery } from "@/hooks/use-data-query";
import { SUPPORT_LABELS } from "@/lib/constants";
import { listPlatformCompanies } from "@/lib/data/platform";
import { openSupportSession } from "@/lib/data/mutations/platform-sessions";
import { formatDateTime } from "@/lib/format";
import type { PlatformCompany } from "@/lib/validation/api/platform";

/**
 * SADM-01 + cua vao cua SADM-02.
 *
 * Bang nay chi hien SO TONG HOP — dung het nhung gi RPC
 * `tf_platform_company_overview()` duoc phep tra ve ma khong can mot phien.
 * Muon biet them mot chu nao ve doanh nghiep nao thi phai MO PHIEN, va lan mo
 * do la mot dong nhat ky (D-55).
 */
export function PlatformView(): React.ReactElement {
  const { data, isLoading, error, reload } = useDataQuery(
    () => listPlatformCompanies(),
    [],
  );

  const [target, setTarget] = React.useState<PlatformCompany | null>(null);
  const [reason, setReason] = React.useState("");
  const [isOpening, setIsOpening] = React.useState(false);

  // Hai duong ghi trang cua SADM-04 — tach ra mot component rieng vi chung
  // KHONG lien quan gi den phien ho tro: chung di qua Admin API, khong qua
  // RLS, va khong doi mot phien nao dang mo.
  const [actionKind, setActionKind] =
    React.useState<PlatformActionKind | null>(null);
  const [actionCompany, setActionCompany] =
    React.useState<PlatformCompany | null>(null);

  const handleOpen = React.useCallback(async () => {
    if (!target) return;
    if (reason.trim().length === 0) {
      toast.error(SUPPORT_LABELS.reasonRequired);
      return;
    }
    setIsOpening(true);
    try {
      await openSupportSession(target.id, reason);
      // Dieu huong bang `window.location` chu khong `router.push`: cookie
      // doanh nghiep hien hanh vua duoc dat o phia server, va toan bo cay
      // Server Component cua `/admin` phai duoc dung lai voi phien MOI.
      window.location.assign("/admin/dashboard");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không mở được phiên hỗ trợ.",
      );
      setIsOpening(false);
    }
  }, [target, reason]);

  if (error) {
    return <ErrorState description={error} onRetry={reload} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {SUPPORT_LABELS.companies}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Toàn bộ doanh nghiệp trên hệ thống. Mở phiên hỗ trợ để xem sâu dữ
            liệu của một nơi — mỗi lần mở đều được ghi vào nhật ký.
          </p>
        </div>
        {/* Cap lai mat khau tam KHONG gan voi doanh nghiep nao — no la thao
            tac cap tai khoan, nen no o day chu khong nam trong mot dong. */}
        <Button
          variant="outline"
          onClick={() => {
            setActionCompany(null);
            setActionKind("reset-password");
          }}
        >
          Cấp lại mật khẩu tạm
        </Button>
      </div>

      {isLoading ? (
        <DataTableSkeleton />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="Chưa có doanh nghiệp nào"
          description="Hệ thống chưa có doanh nghiệp nào được khởi tạo."
        />
      ) : (
        <div className="rounded-card border border-hairline bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doanh nghiệp</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead className="text-right">Số nhân viên</TableHead>
                <TableHead>Hoạt động gần nhất</TableHead>
                <TableHead>Kỳ đang mở</TableHead>
                <TableHead className="text-right">Hỗ trợ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="text-ink-muted">
                    {company.code}
                  </TableCell>
                  <TableCell className="text-right">
                    {company.employeeCount}
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {company.lastActivityAt
                      ? formatDateTime(company.lastActivityAt)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    {company.openPeriodMonth ?? "—"}
                  </TableCell>
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTarget(company);
                        setReason("");
                      }}
                    >
                      {SUPPORT_LABELS.openAction}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActionCompany(company);
                        setActionKind("grant-owner");
                      }}
                    >
                      Cấp quyền chủ
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !isOpening) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{SUPPORT_LABELS.openAction}</DialogTitle>
            <DialogDescription>
              Bạn sắp mở quyền đọc dữ liệu của <strong>{target?.name}</strong>{" "}
              trong 60 phút. Lý do dưới đây được ghi vào nhật ký và doanh nghiệp
              đó đọc được.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="support-reason">
              {SUPPORT_LABELS.reasonLabel}
            </Label>
            <Textarea
              id="support-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={SUPPORT_LABELS.reasonPlaceholder}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setTarget(null)}
              disabled={isOpening}
            >
              Huỷ
            </Button>
            {/* Nut filled indigo DUY NHAT cua khu nay. */}
            <Button onClick={() => void handleOpen()} disabled={isOpening}>
              {isOpening ? "Đang mở…" : SUPPORT_LABELS.openAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlatformActionDialog
        kind={actionKind}
        companyId={actionCompany?.id ?? null}
        companyName={actionCompany?.name ?? null}
        onClose={() => {
          setActionKind(null);
          setActionCompany(null);
        }}
      />
    </div>
  );
}
