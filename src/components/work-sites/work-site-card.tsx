"use client";

import * as React from "react";
import { MapPin, MoreHorizontal, Pencil, Ruler } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WORK_SITE_LABEL } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { WorkSite } from "@/lib/types/domain";

/**
 * The hien thi mot diem lam viec, cung khuon `ShiftCard` (02-06).
 * Dong ban kinh noi RO day la moc DE DO khoang cach, khong phai dieu kien
 * chan cham cong (D-20) — CONFIRM khong dung tu "phai dung trong" hay "moi
 * cham cong duoc".
 */
export function WorkSiteCard({
  workSite,
  onEdit,
  onArchive,
}: {
  workSite: WorkSite;
  onEdit: (workSite: WorkSite) => void;
  onArchive: (workSite: WorkSite) => void;
}): React.ReactElement {
  return (
    <article className="surface-card flex flex-col p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="heading-sm truncate text-ink" title={workSite.name}>
            {workSite.name}
          </h2>
          <div className="mt-1.5">
            <StatusBadge
              kind="custom"
              label={
                workSite.isActive
                  ? WORK_SITE_LABEL.statusActive
                  : WORK_SITE_LABEL.statusInactive
              }
              tone={workSite.isActive ? "success" : "neutral"}
              size="sm"
            />
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Hành động cho ${workSite.name}`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-canvas-soft hover:text-ink"
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => onEdit(workSite)}>
              <Pencil aria-hidden="true" />
              Chỉnh sửa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={!workSite.isActive}
              onSelect={() => onArchive(workSite)}
            >
              {WORK_SITE_LABEL.archiveConfirmLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <dl className="mt-4 grid gap-2.5 text-[13px]">
        <div className="flex items-center gap-2 text-ink-secondary">
          <MapPin aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          <dt className="sr-only">Toạ độ</dt>
          <dd className="num">
            {workSite.latitude.toFixed(6)}, {workSite.longitude.toFixed(6)}
          </dd>
        </div>
        <div className="flex items-start gap-2 text-ink-secondary">
          <Ruler aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-muted" />
          <dt className="sr-only">{WORK_SITE_LABEL.radiusLabel}</dt>
          <dd>
            {WORK_SITE_LABEL.radiusLabel}:{" "}
            <span className="num font-medium text-ink">
              {formatNumber(workSite.radiusMeters)} m
            </span>{" "}
            ({WORK_SITE_LABEL.radiusHelp})
          </dd>
        </div>
      </dl>
    </article>
  );
}
