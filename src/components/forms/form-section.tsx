import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Mot khoi noi dung cua bieu mau.
 * Tren man hinh rong: cot trai la tieu de + mo ta, cot phai la cac truong nhap.
 * Tren dien thoai: don gian xep mot cot.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <section
      className={cn(
        "grid gap-5 border-b border-hairline py-6 first:pt-0 last:border-b-0 lg:grid-cols-[260px_1fr] lg:gap-8",
        className,
      )}
    >
      <div>
        <h2 className="heading-sm text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** O chiem tron chieu ngang trong luoi hai cot cua FormSection */
export function FormFieldFull({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return <div className={cn("sm:col-span-2", className)}>{children}</div>;
}
