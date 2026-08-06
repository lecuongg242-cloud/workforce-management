"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/error-state";
import {
  OvertimeRuleDialog,
  type OvertimeRuleFormValues,
} from "@/components/settings/overtime-rule-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataQuery } from "@/hooks/use-data-query";
import { useAuthenticatedSession } from "@/lib/auth/session-provider";
import {
  OVERTIME_DISCLAIMER,
  OVERTIME_RULE_KEY_HINT,
  OVERTIME_RULE_KEY_LABEL,
  SETTINGS_OVERTIME_LABEL,
} from "@/lib/constants";
import {
  createOvertimeRuleVersion,
  listOvertimeRules,
} from "@/lib/data/overtime-rules";
import { useDataStore } from "@/lib/data/store";
import { formatDate } from "@/lib/format";
import type { OvertimeRuleGroup, OvertimeRuleKey } from "@/lib/types/domain";

/**
 * Tab "Tang ca" cua `/admin/settings` (SET-03, plan 04-04).
 *
 * Bon the — mot cho moi loai ngay. Cho nao doanh nghiep chua khai thi noi
 * THANG la chua khai kem he qua ("gio tang ca cua loai ngay nay chua quy doi
 * duoc"), KHONG hien mot con so mac dinh nao (D-26).
 *
 * Sua he so = THEM MOT PHIEN BAN (D-25): khong co nut sua hay xoa o day, va
 * do khong phai thieu sot — phien ban cu la thu duy nhat lam so lieu cua ky
 * da qua tai lap duoc.
 */
export function OvertimeRulesTab({ today }: { today: string }): React.ReactElement {
  const session = useAuthenticatedSession();
  const { invalidate } = useDataStore();

  const [dialogKey, setDialogKey] = React.useState<OvertimeRuleKey | null>(null);
  const [expanded, setExpanded] = React.useState<OvertimeRuleKey | null>(null);

  const { data: groups, isLoading, error, reload } = useDataQuery(
    () => listOvertimeRules(),
    [session.companyId],
  );

  const handleSubmit = async (values: OvertimeRuleFormValues): Promise<void> => {
    if (!dialogKey) return;
    try {
      await createOvertimeRuleVersion({ ruleKey: dialogKey, ...values });
      toast.success(SETTINGS_OVERTIME_LABEL.saveSuccess);
      invalidate();
      reload();
      setDialogKey(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : SETTINGS_OVERTIME_LABEL.saveError,
      );
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink">
          {SETTINGS_OVERTIME_LABEL.sectionTitle}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {SETTINGS_OVERTIME_LABEL.sectionDescription}
        </p>
        {/* D-28a: cong thuc cong don noi ngay tai noi khai, vi "Phu cap ca
            dem" la mot dai luong KHAC LOAI voi ba he so con lai. */}
        <p className="mt-2 text-xs text-ink-muted">
          {SETTINGS_OVERTIME_LABEL.formulaNote}
        </p>
        {/* Gioi han D-28a noi bang chu ngay tai noi khai he so, khong de nguoi
            dung tu suy ra tu cho khac. */}
        <p className="mt-2 text-xs text-ink-muted">{OVERTIME_DISCLAIMER}</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(groups ?? []).map((group) => (
            <OvertimeRuleCard
              key={group.ruleKey}
              group={group}
              expanded={expanded === group.ruleKey}
              onToggleHistory={() =>
                setExpanded(expanded === group.ruleKey ? null : group.ruleKey)
              }
              onDeclare={() => setDialogKey(group.ruleKey)}
            />
          ))}
        </div>
      )}

      <OvertimeRuleDialog
        open={dialogKey !== null}
        onOpenChange={(open) => {
          if (!open) setDialogKey(null);
        }}
        ruleKey={dialogKey}
        today={today}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function OvertimeRuleCard({
  group,
  expanded,
  onToggleHistory,
  onDeclare,
}: {
  group: OvertimeRuleGroup;
  expanded: boolean;
  onToggleHistory: () => void;
  onDeclare: () => void;
}): React.ReactElement {
  const declared = group.currentMultiplier !== null;
  // D-28a: `night` la PHU CAP CONG THEM, khong phai he so nhan — hien "+0.3"
  // chu khong bao gio "x0.3", vi "x0.3" doc ra thanh "gio dem tra bang 30%
  // mot gio thuong", nguoc han y nghia that.
  const isPremium = group.ruleKey === "night";

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {OVERTIME_RULE_KEY_LABEL[group.ruleKey]}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {OVERTIME_RULE_KEY_HINT[group.ruleKey]}
          </p>
        </div>
        {/* Trang thai phan biet bang BIEU TUONG cong NHAN CHU, khong bang mau
            don thuan (UI-SPEC: status never color-only). */}
        {declared ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {SETTINGS_OVERTIME_LABEL.effectiveFromPrefix}{" "}
            {group.currentEffectiveFrom ? formatDate(group.currentEffectiveFrom) : ""}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
            <AlertCircle className="size-3.5" aria-hidden="true" />
            {SETTINGS_OVERTIME_LABEL.notDeclared}
          </span>
        )}
      </div>

      <div className="mt-3">
        {declared ? (
          <p className="num text-2xl font-semibold text-ink">
            {isPremium ? "+" : "×"}
            {group.currentMultiplier}
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            {isPremium
              ? SETTINGS_OVERTIME_LABEL.notDeclaredHintNight
              : SETTINGS_OVERTIME_LABEL.notDeclaredHint}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onDeclare}>
          <Plus className="size-4" aria-hidden="true" />
          {SETTINGS_OVERTIME_LABEL.declareAction}
        </Button>
        {group.versions.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={onToggleHistory}>
            {expanded
              ? SETTINGS_OVERTIME_LABEL.historyToggleHide
              : SETTINGS_OVERTIME_LABEL.historyToggleShow}
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="text-xs font-medium text-ink-secondary">
            {SETTINGS_OVERTIME_LABEL.historyTitle}
          </p>
          <ul className="mt-2 space-y-1.5">
            {group.versions.map((version) => (
              <li
                key={version.id}
                className="flex items-center justify-between text-xs text-ink-muted"
              >
                <span className="num">
                  {isPremium ? "+" : "×"}
                  {version.multiplier}
                </span>
                <span className="num">
                  {SETTINGS_OVERTIME_LABEL.effectiveFromPrefix}{" "}
                  {formatDate(version.effectiveFrom)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
