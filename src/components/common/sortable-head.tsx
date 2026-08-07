"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/**
 * Tinh trang thai sap xep MOI sau khi bam vao mot cot.
 *
 * Bam lai dung cot dang sap thi DOI CHIEU, khong phai bo sap xep: mot cu bam
 * lam bang nhay ve thu tu goc la thu nguoi dung khong doi va khong hieu.
 * Muon ve thu tu goc thi co nut "Xoa bo loc".
 */
export function nextSort<K extends string>(
  current: SortState<K> | null,
  key: K,
  defaultDirection: SortDirection,
): SortState<K> {
  if (current?.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: defaultDirection };
}

/**
 * Mot o tieu de BAM DUOC de sap xep.
 *
 * Ba dieu khong duoc thieu, vi thieu cai nao thi nguoi dung cung phai doan:
 *   1. Cot nao sap duoc thi luon co bieu tuong, ke ca khi chua sap — khong co
 *      no thi khong ai biet la bam duoc.
 *   2. Cot dang sap co bieu tuong CHI HUONG va chu dam len, de nhin mot cai
 *      la biet bang dang xep theo gi.
 *   3. `aria-sort` tren chinh o `th`, de trinh doc man hinh noi duoc dieu ma
 *      mui ten chi noi bang mat.
 */
export function SortableHead<K extends string>({
  sortKey,
  sort,
  onSort,
  align = "left",
  defaultDirection = "asc",
  title,
  className,
  children,
}: {
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (next: SortState<K>) => void;
  align?: "left" | "right";
  /**
   * Chieu cua LAN BAM DAU. Cot so tien / so luong mac dinh giam dan, vi cau
   * hoi dau tien cua nguoi xem luon la "ai nhieu nhat".
   */
  defaultDirection?: SortDirection;
  title?: string;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const active = sort?.key === sortKey ? sort : null;
  const Icon = active
    ? active.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ChevronsUpDown;

  return (
    <TableHead
      aria-sort={
        active
          ? active.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={cn(align === "right" && "text-right", className)}
    >
      <button
        type="button"
        title={title}
        onClick={() => onSort(nextSort(sort, sortKey, defaultDirection))}
        className={cn(
          "group inline-flex w-full items-center gap-1 rounded-control text-left uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          align === "right" && "flex-row-reverse text-right",
          active ? "text-ink" : "hover:text-ink-secondary",
        )}
      >
        <span>{children}</span>
        <Icon
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0",
            // Cot chua sap: mo di nhung VAN THAY DUOC — day la thu duy nhat
            // noi cho nguoi dung biet cot nay bam duoc.
            active ? "opacity-100" : "opacity-40 group-hover:opacity-70",
          )}
        />
      </button>
    </TableHead>
  );
}
