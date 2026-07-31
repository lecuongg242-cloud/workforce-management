"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, PalmtreeIcon } from "lucide-react";

/** Ba thao tac nhanh o trang chu nhan vien */
export function QuickActions(): React.ReactElement {
  const router = useRouter();

  const actions = [
    {
      icon: PalmtreeIcon,
      label: "Xin nghỉ",
      onClick: () => router.push("/employee/requests?type=leave"),
    },
    {
      icon: CalendarPlus,
      label: "Bổ sung công",
      onClick: () =>
        router.push("/employee/requests?type=attendance_supplement"),
    },
    {
      icon: CalendarDays,
      label: "Lịch làm việc",
      onClick: () => router.push("/employee/history"),
    },
  ];

  return (
    <section>
      <h2 className="heading-sm mb-2.5 text-ink">Thao tác nhanh</h2>
      <div className="grid grid-cols-3 gap-2.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-card border border-hairline bg-white px-2 py-3 text-center shadow-e1 transition-colors hover:bg-canvas-soft"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-wash text-brand-deep">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="text-[12px] leading-tight font-medium text-ink">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
