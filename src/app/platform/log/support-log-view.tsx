"use client";

import * as React from "react";

import { DataTableSkeleton } from "@/components/common/data-table-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataQuery } from "@/hooks/use-data-query";
import { SUPPORT_LABELS } from "@/lib/constants";
import { listSupportSessions } from "@/lib/data/platform";
import { formatDateTime } from "@/lib/format";
import type { SupportSessionLogEntry } from "@/lib/validation/api/platform";

/**
 * SADM-03: nhat ky moi phien ho tro da mo.
 *
 * Bang `support_sessions` CHINH LA nhat ky (D-55) va no khong co policy
 * `delete` — man hinh nay chi doc lai. Khong co bo loc, khong co nut xoa:
 * mot nhat ky co nut xoa thi khong con la nhat ky.
 */
const LIMIT_NOTICE = "Hiển thị 200 phiên gần nhất.";

export function SupportLogView(): React.ReactElement {
  const { data, isLoading, error, reload } = useDataQuery(
    () => listSupportSessions(),
    [],
  );

  if (error) {
    return <ErrorState description={error} onRetry={reload} />;
  }

  const entries = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          {SUPPORT_LABELS.log}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Mỗi lần đội vận hành mở quyền đọc dữ liệu của một doanh nghiệp đều
          nằm ở đây. Doanh nghiệp cũng đọc được các dòng của chính mình.
        </p>
      </div>

      {isLoading ? (
        <DataTableSkeleton columns={5} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Chưa có phiên hỗ trợ nào"
          description="Chưa ai mở quyền đọc dữ liệu của doanh nghiệp nào."
        />
      ) : (
        <>
          <div className="rounded-card border border-hairline bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mở lúc</TableHead>
                  <TableHead>Doanh nghiệp</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Hết hạn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(entry.openedAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.companyName}
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {entry.reason}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-muted">
                      {formatDateTime(entry.expiresAt)}
                    </TableCell>
                    <TableCell>
                      <StatusCell entry={entry} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Gioi han duoc NOI RO: mot bang bi cat am tham doc nhu mot bang
              day du, va do la cach te nhat de mot nhat ky noi doi. */}
          <p className="text-xs text-ink-muted">{LIMIT_NOTICE}</p>
        </>
      )}
    </div>
  );
}

/**
 * Ba trang thai, phan biet duoc bang CHU truoc, mau chi la lop thu hai —
 * cung quy uoc voi luoi thang cua Phase 5.1 (bang hay duoc in ra de ky).
 */
function StatusCell({
  entry,
}: {
  entry: SupportSessionLogEntry;
}): React.ReactElement {
  if (entry.closedAt !== null) {
    return <Badge variant="outline">Đã đóng</Badge>;
  }
  // So sanh o day chi de VE nhan. Quyen truy cap thuc su van do
  // `tf_has_support_access()` quyet dinh o tang database moi lan goi.
  // eslint-disable-next-line timeflow/no-date-in-client -- nhan trang thai cua mot moc thoi gian da co, khong phai "hom nay" cua du lieu
  const now = Date.now();
  if (new Date(entry.expiresAt).getTime() <= now) {
    return <Badge variant="outline">Hết hạn</Badge>;
  }
  return <Badge>Đang mở</Badge>;
}
