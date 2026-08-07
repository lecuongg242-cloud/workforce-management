import * as React from "react";
import { CalendarClock, MapPin, MoonStar } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { formatShiftSchedule } from "@/lib/shifts/schedule";
import type { Shift } from "@/lib/types/domain";

/** The hien thi ca lam viec cua ngay hom nay */
export function CurrentShiftCard({
  shift,
  workLocation,
}: {
  shift: Shift | null;
  workLocation: string;
}): React.ReactElement {
  if (!shift) {
    return (
      <section className="surface-card p-4">
        <p className="text-sm text-ink-muted">
          Bạn chưa được gán ca làm việc. Hãy liên hệ quản lý để được thiết lập.
        </p>
      </section>
    );
  }

  return (
    <section className="surface-card p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-wash text-brand-deep">
          <CalendarClock aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="heading-sm text-ink">{shift.name}</h2>
            {shift.overnight ? (
              <StatusBadge
                kind="custom"
                label="Ca qua đêm"
                tone="info"
                icon={MoonStar}
                size="sm"
              />
            ) : null}
          </div>
          <p className="num mt-0.5 text-[15px] text-ink-secondary">
            {formatShiftSchedule(shift)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            {workLocation}
          </p>
        </div>
      </div>
    </section>
  );
}
