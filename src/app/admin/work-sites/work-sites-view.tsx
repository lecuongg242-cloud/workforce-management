"use client";

import * as React from "react";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { WorkSiteCard } from "@/components/work-sites/work-site-card";
import { WorkSiteDialog } from "@/components/work-sites/work-site-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import { WORK_SITE_LABEL } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import {
  archiveWorkSite,
  createWorkSite,
  listWorkSites,
  updateWorkSite,
} from "@/lib/data/work-sites";
import { useDataStore } from "@/lib/data/store";
import type { WorkSite } from "@/lib/types/domain";
import type { WorkSiteFormValues } from "@/lib/validation/schemas";

/**
 * Man hinh khai bao diem lam viec, cung khuon `ShiftsView` (02-06):
 * PageHeader kem so dem + mot nut mau nhan, useDataQuery, bo ba
 * skeleton/rong/loi, ConfirmDialog cho luu tru, toast cho ket qua,
 * invalidate() sau moi lan ghi.
 */
export function WorkSitesView(): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<WorkSite | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<WorkSite | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const { data: workSites, isLoading, error, reload } = useDataQuery(
    () => listWorkSites(session.companyId),
    [session.companyId],
  );

  const handleSubmit = async (values: WorkSiteFormValues): Promise<void> => {
    try {
      // isActive khong nam trong form (WorkSiteDialog) — bat/tat la hanh
      // dong rieng (archiveWorkSite), ghep gia tri hien co khi sua, mac dinh
      // true khi tao moi.
      const payload = { ...values, isActive: editing ? editing.isActive : true };
      if (editing) {
        await updateWorkSite(editing.id, payload);
        toast.success(`Đã cập nhật ${values.name}.`);
      } else {
        await createWorkSite(session.companyId, payload);
        toast.success(`Đã thêm ${values.name}.`);
      }
      invalidate();
      setDialogOpen(false);
      setEditing(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không lưu được điểm làm việc.",
      );
    }
  };

  const handleArchive = async (): Promise<void> => {
    if (!archiveTarget) return;
    setIsPending(true);
    try {
      await archiveWorkSite(archiveTarget.id);
      invalidate();
      toast.success(`Đã ngừng sử dụng ${archiveTarget.name}.`);
      setArchiveTarget(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không cập nhật được điểm làm việc.",
      );
    } finally {
      setIsPending(false);
    }
  };

  const activeWorkSites = workSites?.filter((site) => site.isActive) ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Điểm làm việc"
        description={
          workSites ? (
            <>
              <span className="num font-medium text-ink">
                {formatNumber(activeWorkSites.length)}
              </span>{" "}
              điểm đang dùng trên tổng số{" "}
              <span className="num font-medium text-ink">
                {formatNumber(workSites.length)}
              </span>{" "}
              điểm đã khai báo.
            </>
          ) : (
            "Đang tải danh sách điểm làm việc…"
          )
        }
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            {WORK_SITE_LABEL.addButton}
          </Button>
        }
      />

      {error ? (
        <div className="surface-card">
          <ErrorState description={error} onRetry={reload} />
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-card" />
          ))}
        </div>
      ) : !workSites || workSites.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={MapPin}
            title={WORK_SITE_LABEL.emptyTitle}
            description={WORK_SITE_LABEL.emptyBody}
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus aria-hidden="true" />
                {WORK_SITE_LABEL.addButton}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workSites.map((workSite) => (
            <WorkSiteCard
              key={workSite.id}
              workSite={workSite}
              onEdit={(item) => {
                setEditing(item);
                setDialogOpen(true);
              }}
              onArchive={setArchiveTarget}
            />
          ))}
        </div>
      )}

      <WorkSiteDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        workSite={editing}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title={`Ngừng sử dụng ${archiveTarget?.name ?? ""}?`}
        description={WORK_SITE_LABEL.archiveConfirmBody}
        confirmLabel={WORK_SITE_LABEL.archiveConfirmLabel}
        tone="destructive"
        isPending={isPending}
        onConfirm={handleArchive}
      />
    </div>
  );
}
