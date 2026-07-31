import * as React from "react";

import { formatDurationShort, formatTime } from "@/lib/format";

/**
 * Anh minh hoa san pham dung tren trang dang nhap: mot bang cong thu nho.
 * Hoan toan tinh, khong dung anh stock, so lieu dung chu so dang bang.
 */

interface MockRow {
  name: string;
  shift: string;
  checkIn: string;
  checkOut: string;
  minutes: number;
  tone: "success" | "warning";
  status: string;
}

const rows: MockRow[] = [
  {
    name: "Nguyễn Minh Anh",
    shift: "Hành chính",
    checkIn: "07:52",
    checkOut: "17:34",
    minutes: 492,
    tone: "success",
    status: "Đúng giờ",
  },
  {
    name: "Trần Hoàng Nam",
    shift: "Hành chính",
    checkIn: "07:40",
    checkOut: "17:30",
    minutes: 500,
    tone: "success",
    status: "Đúng giờ",
  },
  {
    name: "Lê Thu Hương",
    shift: "Hành chính",
    checkIn: "08:12",
    checkOut: "17:33",
    minutes: 471,
    tone: "warning",
    status: "Đi muộn",
  },
  {
    name: "Phạm Quốc Khánh",
    shift: "Ca sáng",
    checkIn: "05:55",
    checkOut: "14:02",
    minutes: 457,
    tone: "success",
    status: "Đúng giờ",
  },
];

export function DashboardMockup(): React.ReactElement {
  return (
    <div className="w-full max-w-[420px] rounded-panel border border-white/40 bg-white/95 p-4 shadow-e2 backdrop-blur-[2px]">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-ink">Bảng công hôm nay</p>
        <p className="num text-[11px] text-ink-muted">27/07/2026</p>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { label: "Đã chấm công", value: "22" },
          { label: "Đi muộn", value: "3" },
          { label: "Đang nghỉ", value: "2" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[10px] border border-hairline bg-canvas-soft px-2.5 py-2"
          >
            <p className="num display-md leading-none text-ink">{item.value}</p>
            <p className="mt-1 text-[10px] leading-tight text-ink-muted">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <table className="w-full border-separate border-spacing-y-1 text-left">
        <thead>
          <tr className="text-[10px] tracking-wide text-ink-muted uppercase">
            <th className="font-medium">Nhân viên</th>
            <th className="font-medium">Vào</th>
            <th className="font-medium">Ra</th>
            <th className="text-right font-medium">Tổng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="text-[11px]">
              <td className="py-1">
                <span className="block leading-tight text-ink">{row.name}</span>
                <span className="flex items-center gap-1 leading-tight text-ink-muted">
                  <span
                    className={
                      row.tone === "success"
                        ? "inline-block size-1.5 rounded-full bg-success"
                        : "inline-block size-1.5 rounded-full bg-warning"
                    }
                  />
                  {row.status} · {row.shift}
                </span>
              </td>
              <td className="num text-ink-secondary">{formatTime(row.checkIn)}</td>
              <td className="num text-ink-secondary">{formatTime(row.checkOut)}</td>
              <td className="num text-right text-ink">
                {formatDurationShort(row.minutes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
