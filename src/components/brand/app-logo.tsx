import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Bieu tuong va ten san pham nam gon trong mot file duy nhat.
 * Doi thuong hieu chi can sua o day (va hang `APP_NAME` trong constants).
 */

type LogoVariant = "light" | "dark";
type LogoSize = "sm" | "md" | "lg";

const markSize: Record<LogoSize, string> = {
  sm: "size-7",
  md: "size-8",
  lg: "size-10",
};

const wordmarkSize: Record<LogoSize, string> = {
  sm: "text-[15px]",
  md: "text-[17px]",
  lg: "text-[20px]",
};

export function AppLogoMark({
  variant = "dark",
  size = "md",
  className,
}: {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}): React.ReactElement {
  const onDark = variant === "light";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[10px]",
        onDark ? "bg-white/12 text-white" : "bg-brand text-white",
        markSize[size],
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="size-[62%]"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Vong dong ho — bieu tuong thoi gian lam viec */}
        <circle
          cx="12"
          cy="12"
          r="8.5"
          stroke="currentColor"
          strokeWidth="1.6"
          opacity={0.55}
        />
        <path d="M12 7.2V12l3.2 2" stroke="currentColor" strokeWidth="1.9" />
      </svg>
    </span>
  );
}

export function AppLogo({
  variant = "dark",
  size = "md",
  showWordmark = true,
  className,
}: {
  variant?: LogoVariant;
  size?: LogoSize;
  showWordmark?: boolean;
  className?: string;
}): React.ReactElement {
  const onDark = variant === "light";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AppLogoMark variant={variant} size={size} />
      {showWordmark ? (
        <span
          className={cn(
            "font-medium tracking-[-0.3px]",
            wordmarkSize[size],
            onDark ? "text-white" : "text-ink",
          )}
        >
          {APP_NAME}
        </span>
      ) : null}
      <span className="sr-only">{APP_NAME}</span>
    </span>
  );
}
