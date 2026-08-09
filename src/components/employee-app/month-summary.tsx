import * as React from "react";

import { OVERTIME_DISPLAY_LABEL } from "@/lib/constants";
import { formatDurationShort, formatMonthLabel, formatNumber } from "@/lib/format";
import type { MonthlySummary } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/**
 * Bon o tong hop cong trong thang, cong hai o gio co ban / gio tang ca khi
 * duong doc co mang so lieu tang ca (SET-04, plan 04-05).
 *
 * HAI O GIO KIA DI THANH CAP va nam ngay duoi "Tong gio lam", vi chung la mot
 * phep cong doc duoc bang mat: co ban + tang ca = tong. Tach mot trong hai ra
 * cho khac hoac hien mot minh no se lam nguoi doc phai tu tru — dung viec ma
 * hai o nay sinh ra de khoi phai lam.
 *
 * KHONG CON O "QUY DOI". Gio quy doi van duoc tinh va van la duong ra tien tang
 * ca, nhung no la mot buoc TRUNG GIAN: nhan vien can biet minh tang ca bao
 * nhieu gio, va bay nhieu gio do ra bao nhieu tien — con so o giua chi lam ho
 * phai tu nhan. Phan tien nam o the tung ngay cua man Lich su.
 */
export function MonthSummary({
  summary,
  title,
}: {
  summary: MonthlySummary;
  title?: string;
}): React.ReactElement {
  const overtimeMinutes = summary.overtimeMinutes ?? 0;
  const hasOvertimeData = summary.overtimeMinutes !== undefined;

  /**
   * GIO CO BAN — gio lam KHONG tinh tang ca.
   *
   * Uu tien con so cua server: do la CHINH so phut duoc tra theo don gia
   * thuong (`sumCreditedDays`), tuc con so di vao bang luong. Phep tru tai cho
   * chi la duong lui cho nhung noi goi chua mang truong nay — no ra cung ket
   * qua, nhung khong noi duoc "chua khai mau so" (`null`, D-26) ma chi lang le
   * tra ve tong so gio lam.
   */
  const regularMinutes =
    summary.regularMinutes !== undefined
      ? summary.regularMinutes
      : summary.totalMinutes - overtimeMinutes;

  /**
   * `strong` = o mang SO GIO, thu ma man hinh nay ton tai de noi.
   *
   * Bon o con lai la so dem — huu ich, nhung khong phai thu nguoi ta mo trang
   * ra de xem. Cho ca sau o cung mot do dam thi mat khong biet dung o dau, va
   * do dung la dieu dang duoc sua.
   */
  const items = [
    { label: "Ngày công", value: formatNumber(summary.workedDays) },
    {
      label: "Tổng giờ làm",
      value: formatDurationShort(summary.totalMinutes),
      strong: true,
    },
    ...(hasOvertimeData
      ? [
          {
            label: "Giờ cơ bản",
            value:
              regularMinutes === null
                ? "—"
                : formatDurationShort(regularMinutes),
            strong: true,
          },
          {
            label: OVERTIME_DISPLAY_LABEL.overtimeRawLabel,
            value:
              overtimeMinutes > 0 ? formatDurationShort(overtimeMinutes) : "—",
            strong: true,
          },
        ]
      : []),
    { label: "Đi muộn", value: `${formatNumber(summary.lateCount)} lần` },
    { label: "Nghỉ phép", value: `${formatNumber(summary.leaveDays)} ngày` },
  ];

  return (
    <section className="surface-card p-4">
      <h2 className="heading-sm text-ink">
        {title ?? formatMonthLabel(summary.month)}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-2.5">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "rounded-control border px-3 py-2.5",
              item.strong
                ? "border-hairline bg-canvas-soft"
                : "border-transparent bg-canvas-soft/60",
              // O LE CUOI CUNG chiem tron hang. So o thay doi theo duong doc
              // (bon o, hoac nam o khi co so lieu tang ca), nen mot o mo coi o
              // goc phai la truong hop CO THAT chu khong phai gia thiet — va no
              // doc ra nhu mot cho bi thieu mat mot con so.
              index === items.length - 1 && items.length % 2 === 1 &&
                "col-span-2",
            )}
          >
            <dt className="text-[11px] leading-tight text-ink-muted">
              {item.label}
            </dt>
            <dd
              className={cn(
                "num mt-1 leading-tight",
                item.strong
                  ? "text-[19px] font-semibold text-ink"
                  : "text-[15px] font-medium text-ink-secondary",
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
