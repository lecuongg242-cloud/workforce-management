"use client";

import * as React from "react";
import { FlaskConical } from "lucide-react";

import type { CheckInState } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

/**
 * Cong cu demo: chuyen nhanh giua ba trang thai cham cong.
 *
 * Day KHONG phai chuc nang danh cho nguoi dung cuoi. Khi ket noi backend that,
 * chi can xoa component nay va lenh goi no trong `employee-home-view.tsx`.
 */

const OPTIONS: Array<{ value: CheckInState | "real"; label: string }> = [
  { value: "real", label: "Dữ liệu thật" },
  { value: "not_started", label: "Chưa vào ca" },
  { value: "working", label: "Đang làm việc" },
  { value: "finished", label: "Đã tan ca" },
];

export function DemoStateSwitcher({
  value,
  onChange,
}: {
  value: CheckInState | null;
  onChange: (value: CheckInState | null) => void;
}): React.ReactElement {
  const current = value ?? "real";

  return (
    <section className="rounded-card border border-dashed border-hairline-input bg-canvas-soft p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-ink-muted uppercase">
        <FlaskConical aria-hidden="true" className="size-3.5" />
        Chế độ xem thử
      </p>
      <div
        role="group"
        aria-label="Chọn trạng thái chấm công để xem thử"
        className="grid grid-cols-2 gap-1.5"
      >
        {OPTIONS.map((option) => {
          const selected = current === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange(option.value === "real" ? null : option.value)
              }
              className={cn(
                "min-h-11 rounded-full border px-3 text-[13px] font-medium transition-colors",
                selected
                  ? "border-brand bg-white text-brand"
                  : "border-hairline bg-white/60 text-ink-muted hover:bg-white",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
