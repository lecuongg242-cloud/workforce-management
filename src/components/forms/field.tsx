"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Boc mot truong nhap lieu: nhan that (`<label htmlFor>`), mo ta va thong bao loi.
 * Tu dong gan `aria-describedby` / `aria-invalid` cho phan tu con.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-[13px] font-medium text-ink-secondary">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>

      {/*
        Gan id / aria xuong phan tu con de <label htmlFor> tro dung dich.
        Luu y: phan tu con phai la mot control that (Input, Textarea…),
        khong duoc boc them <div>. Voi Select cua Radix, id duoc truyen
        thang cho SelectTrigger tai noi su dung.
      */}
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            {
              id,
              "aria-describedby": describedBy,
              "aria-invalid": error ? true : undefined,
            },
          )
        : children}

      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
