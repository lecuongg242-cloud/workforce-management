"use client";

import * as React from "react";
import { Minus, Plus, Users, X } from "lucide-react";

import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAY_ADJUSTMENT_BASIS_LABEL,
  PAY_ADJUSTMENT_KIND_LABEL,
  PAY_ADJUSTMENT_LABEL,
  PAY_ADJUSTMENT_SCOPE_TYPE_LABEL,
  PAY_ADJUSTMENT_VALUE_TYPE_LABEL,
} from "@/lib/constants";
import { resolveTargets, type ScopeEmployee } from "@/lib/payroll/scope";
import type {
  Department,
  PayAdjustment,
  PayAdjustmentInput,
  PayAdjustmentScopeInput,
  PayAdjustmentScopeType,
} from "@/lib/types/domain";

/**
 * Hop thoai khai MOT khoan phu cap / khau tru (PAY-04, plan 05-2-03).
 *
 * PHAN QUAN TRONG NHAT LA KHOI XEM TRUOC o cuoi. Nguoi khai KHONG co cach nao
 * tu suy ra "ai bi ap" tu bon o cau hinh — pham vi va loai tru la hai chieu,
 * va so khop chuc vu la so khop chuoi (go sai mot chu la khong khop ai). Neu
 * ho doan sai thi khong co gi bao dong: nguoi mat phu cap dang co se khong
 * biet de hoi.
 *
 * Vi vay khoi xem truoc chay `resolveTargets()` — DUNG mo-dun ma phep tinh
 * luong se dung — va cap nhat ngay moi lan doi mot dong pham vi.
 *
 * KHONG mot con so tien nao duoc tinh o day. `% luong ngay` chi la mot cach
 * khai gia tri.
 */

type ScopeDraft = PayAdjustmentScopeInput;

interface DraftState {
  name: string;
  kind: "allowance" | "deduction";
  valueType: "fixed_amount" | "percent_of_daily_wage";
  value: string;
  basis: "per_period" | "per_late";
  isActive: boolean;
  includes: ScopeDraft[];
  excludes: ScopeDraft[];
}

function emptyDraft(): DraftState {
  return {
    name: "",
    kind: "allowance",
    valueType: "fixed_amount",
    // Chuoi rong, KHONG mot con so goi y nao — mot gia tri dien san la mot cach
    // ngam de xuat rang he thong biet truoc muc doanh nghiep nen tra (D-26).
    value: "",
    basis: "per_period",
    isActive: true,
    includes: [],
    excludes: [],
  };
}

function toDraft(adjustment: PayAdjustment): DraftState {
  return {
    name: adjustment.name,
    kind: adjustment.kind,
    valueType: adjustment.valueType,
    value: String(adjustment.value),
    basis: adjustment.basis,
    isActive: adjustment.isActive,
    includes: adjustment.scopes
      .filter((scope) => scope.mode === "include")
      .map((scope) => ({
        mode: "include" as const,
        scopeType: scope.scopeType,
        scopeValue: scope.scopeValue,
      })),
    excludes: adjustment.scopes
      .filter((scope) => scope.mode === "exclude")
      .map((scope) => ({
        mode: "exclude" as const,
        scopeType: scope.scopeType,
        scopeValue: scope.scopeValue,
      })),
  };
}

export function PayAdjustmentDialog({
  open,
  onOpenChange,
  adjustment,
  employees,
  departments,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` khi dang TAO mot khoan moi. */
  adjustment: PayAdjustment | null;
  employees: Array<{ id: string; fullName: string; departmentId: string; position: string }>;
  departments: Department[];
  onSubmit: (values: PayAdjustmentInput) => Promise<void>;
}): React.ReactElement {
  const [draft, setDraft] = React.useState<DraftState>(emptyDraft);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDraft(adjustment ? toDraft(adjustment) : emptyDraft());
    setError(null);
  }, [open, adjustment]);

  const scopeEmployees: ScopeEmployee[] = React.useMemo(
    () =>
      employees.map((employee) => ({
        id: employee.id,
        departmentId: employee.departmentId,
        position: employee.position,
      })),
    [employees],
  );

  /** Danh sach chuc vu co that trong doanh nghiep — de nguoi khai khong go tay. */
  const positions = React.useMemo(
    () =>
      Array.from(
        new Set(
          employees.map((employee) => employee.position.trim()).filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "vi")),
    [employees],
  );

  // Khoi xem truoc: chay DUNG mo-dun ma phep tinh luong dung, tren tap pham vi
  // dang soan — khong phai tren tap da luu.
  const targets = React.useMemo(() => {
    const scopes = [...draft.includes, ...draft.excludes].map((scope, index) => ({
      id: `draft-${index}`,
      companyId: "",
      adjustmentId: "",
      mode: scope.mode,
      scopeType: scope.scopeType,
      scopeValue: scope.scopeValue,
    }));
    return resolveTargets({ employees: scopeEmployees, scopes });
  }, [draft.includes, draft.excludes, scopeEmployees]);

  const targetNames = React.useMemo(() => {
    const byId = new Map(employees.map((employee) => [employee.id, employee.fullName]));
    return targets.map((target) => byId.get(target.id) ?? target.id);
  }, [targets, employees]);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    const value = Number(draft.value);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Giá trị phải là một con số lớn hơn 0.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: draft.name,
        kind: draft.kind,
        valueType: draft.valueType,
        value,
        basis: draft.basis,
        isActive: draft.isActive,
        scopes: [...draft.includes, ...draft.excludes],
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : PAY_ADJUSTMENT_LABEL.saveError,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /** O chon gia tri cua mot dong pham vi, doi theo `scopeType`. */
  function scopeValueControl(
    scope: ScopeDraft,
    onChange: (next: ScopeDraft) => void,
  ): React.ReactElement | null {
    if (scope.scopeType === "company") return null;

    const options =
      scope.scopeType === "department"
        ? departments.map((department) => ({
            value: department.id,
            label: department.name,
          }))
        : scope.scopeType === "position"
          ? positions.map((position) => ({ value: position, label: position }))
          : employees.map((employee) => ({
              value: employee.id,
              label: employee.fullName,
            }));

    return (
      <Select
        value={scope.scopeValue ?? ""}
        onValueChange={(next) => onChange({ ...scope, scopeValue: next })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Chọn giá trị" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {adjustment
              ? PAY_ADJUSTMENT_LABEL.dialogEditTitle
              : PAY_ADJUSTMENT_LABEL.dialogCreateTitle}
          </DialogTitle>
          <DialogDescription>
            {PAY_ADJUSTMENT_LABEL.dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <form id="pay-adjustment-form" onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="adj-name" label={PAY_ADJUSTMENT_LABEL.fieldName} required>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </Field>

            <Field id="adj-kind" label={PAY_ADJUSTMENT_LABEL.fieldKind} required>
              <Select
                value={draft.kind}
                onValueChange={(next) =>
                  setDraft({
                    ...draft,
                    kind: next as DraftState["kind"],
                    // Phat di muon khong the la khoan CONG (D-41) — doi loai
                    // ve "phu cap" thi cach ap phai quay ve "moi ky", neu
                    // khong nguoi dung se gap mot loi kho hieu luc bam luu.
                    basis: next === "allowance" ? "per_period" : draft.basis,
                  })
                }
              >
                <SelectTrigger id="adj-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["allowance", "deduction"] as const).map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {PAY_ADJUSTMENT_KIND_LABEL[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              id="adj-value-type"
              label={PAY_ADJUSTMENT_LABEL.fieldValueType}
              hint={PAY_ADJUSTMENT_LABEL.percentNote}
              required
            >
              <Select
                value={draft.valueType}
                onValueChange={(next) =>
                  setDraft({ ...draft, valueType: next as DraftState["valueType"] })
                }
              >
                <SelectTrigger id="adj-value-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["fixed_amount", "percent_of_daily_wage"] as const).map((type) => (
                    <SelectItem key={type} value={type}>
                      {PAY_ADJUSTMENT_VALUE_TYPE_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              id="adj-value"
              label={`${PAY_ADJUSTMENT_LABEL.fieldValue} ${
                draft.valueType === "fixed_amount" ? "(₫)" : "(%)"
              }`}
              required
            >
              <Input
                type="number"
                step={draft.valueType === "fixed_amount" ? "1000" : "0.5"}
                min="0.01"
                max={draft.valueType === "fixed_amount" ? undefined : "100"}
                className="num"
                value={draft.value}
                onChange={(event) =>
                  setDraft({ ...draft, value: event.target.value })
                }
              />
            </Field>

            <Field
              id="adj-basis"
              label={PAY_ADJUSTMENT_LABEL.fieldBasis}
              hint={PAY_ADJUSTMENT_LABEL.fieldBasisHint}
              className="sm:col-span-2"
              required
            >
              <Select
                value={draft.basis}
                onValueChange={(next) =>
                  setDraft({ ...draft, basis: next as DraftState["basis"] })
                }
              >
                <SelectTrigger id="adj-basis" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_period">
                    {PAY_ADJUSTMENT_BASIS_LABEL.per_period}
                  </SelectItem>
                  {/* Chi hien khi la khoan tru — mot lua chon khong bao gio
                      hop le thi khong nen co mat de nguoi dung thu roi gap loi. */}
                  {draft.kind === "deduction" ? (
                    <SelectItem value="per_late">
                      {PAY_ADJUSTMENT_BASIS_LABEL.per_late}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* ---------------------------------------------------- Pham vi */}
          <ScopeList
            title={PAY_ADJUSTMENT_LABEL.scopeSectionTitle}
            hint={PAY_ADJUSTMENT_LABEL.scopeSectionHint}
            addLabel={PAY_ADJUSTMENT_LABEL.scopeAddAction}
            icon={Plus}
            scopes={draft.includes}
            allowScopeTypeChoice
            onAdd={() =>
              setDraft({
                ...draft,
                includes: [
                  ...draft.includes,
                  { mode: "include", scopeType: "company", scopeValue: null },
                ],
              })
            }
            onChange={(index, next) =>
              setDraft({
                ...draft,
                includes: draft.includes.map((scope, i) => (i === index ? next : scope)),
              })
            }
            onRemove={(index) =>
              setDraft({
                ...draft,
                includes: draft.includes.filter((_, i) => i !== index),
              })
            }
            renderValue={scopeValueControl}
          />

          {/* ---------------------------------------------------- Loai tru */}
          <ScopeList
            title={PAY_ADJUSTMENT_LABEL.excludeSectionTitle}
            hint={PAY_ADJUSTMENT_LABEL.excludeSectionHint}
            addLabel={PAY_ADJUSTMENT_LABEL.excludeAddAction}
            icon={Minus}
            scopes={draft.excludes}
            allowScopeTypeChoice={false}
            onAdd={() =>
              setDraft({
                ...draft,
                excludes: [
                  ...draft.excludes,
                  { mode: "exclude", scopeType: "employee", scopeValue: null },
                ],
              })
            }
            onChange={(index, next) =>
              setDraft({
                ...draft,
                excludes: draft.excludes.map((scope, i) => (i === index ? next : scope)),
              })
            }
            onRemove={(index) =>
              setDraft({
                ...draft,
                excludes: draft.excludes.filter((_, i) => i !== index),
              })
            }
            renderValue={scopeValueControl}
          />

          {/* -------------------------------------------------- Xem truoc */}
          <section className="rounded-control border border-hairline bg-canvas-soft p-3">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-ink">
              <Users aria-hidden="true" className="size-4 text-ink-muted" />
              {PAY_ADJUSTMENT_LABEL.previewTitle}
              <span className="num font-semibold">
                ({targets.length} {PAY_ADJUSTMENT_LABEL.previewCount})
              </span>
            </h3>
            {targets.length === 0 ? (
              <p className="mt-1.5 text-xs text-ink-muted">
                {PAY_ADJUSTMENT_LABEL.previewEmpty}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-ink-secondary">
                {targetNames.join(" · ")}
              </p>
            )}
          </section>

          {error ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {PAY_ADJUSTMENT_LABEL.cancel}
          </Button>
          <Button type="submit" form="pay-adjustment-form" disabled={isSubmitting}>
            {PAY_ADJUSTMENT_LABEL.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Danh sach cac dong pham vi cua MOT chieu (gom vao hoac loai ra).
 *
 * Chieu "loai tru" khong cho chon kieu pham vi: loai tru theo phong ban hay
 * theo chuc vu la mot cach dien dat de gay hieu nham ("toan cong ty tru phong
 * Kho" doc ra giong "chi phong Kho"), va chua co yeu cau nao can no. Loai tru
 * o day luon la theo TUNG NGUOI.
 */
function ScopeList({
  title,
  hint,
  addLabel,
  icon: Icon,
  scopes,
  allowScopeTypeChoice,
  onAdd,
  onChange,
  onRemove,
  renderValue,
}: {
  title: string;
  hint: string;
  addLabel: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  scopes: ScopeDraft[];
  allowScopeTypeChoice: boolean;
  onAdd: () => void;
  onChange: (index: number, next: ScopeDraft) => void;
  onRemove: (index: number) => void;
  renderValue: (
    scope: ScopeDraft,
    onChange: (next: ScopeDraft) => void,
  ) => React.ReactElement | null;
}): React.ReactElement {
  return (
    <section className="grid gap-2">
      <div>
        <h3 className="text-[13px] font-medium text-ink-secondary">{title}</h3>
        <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
      </div>

      {scopes.map((scope, index) => (
        <div key={index} className="flex items-center gap-2">
          {allowScopeTypeChoice ? (
            <Select
              value={scope.scopeType}
              onValueChange={(next) =>
                onChange(index, {
                  ...scope,
                  scopeType: next as PayAdjustmentScopeType,
                  // Doi kieu thi gia tri cu khong con nghia gi — xoa di thay
                  // vi giu lai mot gia tri tro toi nham loai doi tuong.
                  scopeValue: null,
                })
              }
            >
              <SelectTrigger className="w-48 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["company", "department", "position", "employee"] as const).map(
                  (type) => (
                    <SelectItem key={type} value={type}>
                      {PAY_ADJUSTMENT_SCOPE_TYPE_LABEL[type]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          ) : null}

          <div className="min-w-0 flex-1">
            {renderValue(scope, (next) => onChange(index, next))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={PAY_ADJUSTMENT_LABEL.removeAction}
            onClick={() => onRemove(index)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ))}

      <div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Icon className="size-4" aria-hidden />
          {addLabel}
        </Button>
      </div>
    </section>
  );
}
