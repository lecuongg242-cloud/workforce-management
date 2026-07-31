"use client";

import * as React from "react";
import { FilterX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Nhan cho lua chon "tat ca" */
  allLabel: string;
}

/**
 * Thanh cong cu loc dung chung: o tim kiem (truyen qua `search`),
 * cac o chon va nut xoa bo loc.
 */
export function FilterBar({
  search,
  filters,
  onReset,
  hasActiveFilter,
  trailing,
  className,
}: {
  search?: React.ReactNode;
  filters: FilterConfig[];
  onReset: () => void;
  hasActiveFilter: boolean;
  trailing?: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-hairline p-3 lg:flex-row lg:items-center lg:gap-2.5",
        className,
      )}
    >
      {search ? <div className="lg:w-72">{search}</div> : null}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:flex lg:flex-1 lg:flex-wrap lg:items-center">
        {filters.map((filter) => (
          <div key={filter.id} className="min-w-0">
            <label htmlFor={filter.id} className="sr-only">
              {filter.label}
            </label>
            <Select value={filter.value} onValueChange={filter.onChange}>
              <SelectTrigger
                id={filter.id}
                aria-label={filter.label}
                className="w-full lg:w-auto lg:min-w-[150px]"
              >
                <SelectValue placeholder={filter.allLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{filter.allLabel}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        {hasActiveFilter ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="col-span-2 justify-self-start sm:col-span-1 lg:ml-1"
          >
            <FilterX aria-hidden="true" />
            Xóa bộ lọc
          </Button>
        ) : null}
      </div>

      {trailing ? <div className="lg:ml-auto">{trailing}</div> : null}
    </div>
  );
}
