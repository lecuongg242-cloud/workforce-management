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
    /*
      `content-start` (align-content: start) GIU NHAN VA O NHAP THANG HANG voi
      cac truong ben canh, va do la ly do duy nhat no co mat.

      Mac dinh `align-content` cua mot grid la `stretch`, va no gian cac hang co
      kich thuoc `auto` — ba hang cua khoi nay deu vay. Trong luoi hai cot cua
      `FormSection`, moi o bi keo cao bang o cao nhat CUNG HANG; neu o ben canh
      co dong ghi chu (`hint`) hoac dong loi ma o nay khong co, phan chieu cao
      thua se duoc chia deu vao ba hang ben trong — nhan tut xuong vai pixel, o
      nhap tut theo, va hai truong cung mot hang trong nhu bi lech nhau.

      `content-start` don phan thua ay xuong duoi cung thay vi rai vao giua.
    */
    <div className={cn("grid content-start gap-1.5", className)}>
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
