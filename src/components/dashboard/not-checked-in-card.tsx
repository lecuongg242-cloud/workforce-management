import * as React from "react";
import Link from "next/link";
import { CheckCircle2, MessageSquare, Phone } from "lucide-react";

import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import type { DashboardSummary } from "@/lib/types/domain";

/** Danh sach ngan nhung nguoi chua cham cong, kem nut lien he nhanh */
export function NotCheckedInCard({
  items,
}: {
  items: DashboardSummary["notCheckedIn"];
}): React.ReactElement {
  return (
    <section className="surface-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3.5">
        <div>
          <h2 className="heading-sm text-ink">Nhân viên chưa chấm công</h2>
          <p className="num mt-0.5 text-xs text-ink-muted">
            {formatNumber(items.length)} người cần theo dõi
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Tất cả đã chấm công"
          description="Không còn ai cần nhắc nhở hôm nay."
          compact
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {items.map((item) => (
            <li key={item.employeeId} className="flex items-center gap-3 px-4 py-3">
              <EmployeeAvatar
                name={item.employeeName}
                avatarUrl={item.avatarUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/employees/${item.employeeId}`}
                  className="block truncate rounded-sm text-sm font-medium text-ink hover:text-brand"
                >
                  {item.employeeName}
                </Link>
                <p className="truncate text-xs text-ink-muted">
                  {item.departmentName} · {item.shiftName}
                </p>
              </div>
              {/* Chua khai so dien thoai (0028) thi KHONG dung hai nut nay.
                  Dung chung se sinh ra `tel:null` — mot nut trong bam duoc
                  nhung khong goi duoc ai, va nguoi dung chi biet dieu do sau
                  khi da bam. Mot dong chu noi thang thi tra loi ngay duoc cau
                  hoi "sao khong goi duoc". */}
              {item.phone === null ? (
                <span className="shrink-0 text-xs text-ink-muted">
                  Chưa có số điện thoại
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    asChild
                    aria-label={`Gọi cho ${item.employeeName}`}
                  >
                    <a href={`tel:${item.phone}`}>
                      <Phone aria-hidden="true" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    asChild
                    aria-label={`Nhắn tin cho ${item.employeeName}`}
                  >
                    <a href={`sms:${item.phone}`}>
                      <MessageSquare aria-hidden="true" />
                    </a>
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
