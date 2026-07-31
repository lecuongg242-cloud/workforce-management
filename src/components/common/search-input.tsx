"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** O tim kiem co nut xoa nhanh; label an nhung van doc duoc bang trinh doc man hinh */
export function SearchInput({
  value,
  onValueChange,
  placeholder = "Tìm kiếm…",
  label = "Tìm kiếm",
  id,
  className,
  inputClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  className?: string;
  inputClassName?: string;
}): React.ReactElement {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
      />
      <Input
        id={inputId}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          "pl-9 [&::-webkit-search-cancel-button]:hidden",
          value ? "pr-9" : "",
          inputClassName,
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Xóa từ khóa tìm kiếm"
          onClick={() => onValueChange("")}
          className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-canvas-soft hover:text-ink"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
