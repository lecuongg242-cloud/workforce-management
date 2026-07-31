import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Nen gradient mesh: kem -> cam nhe -> lavender -> indigo -> ruby.
 *
 * Dung SVG voi cac khoi mau duoc lam mo (feGaussianBlur) thay vi CSS gradient
 * phang, de co cam giac "khoi mau huu co" nhu mo ta trong tai lieu thiet ke.
 *
 * CHI dung o: trang dang nhap, trang tao doanh nghiep va phan chao mung
 * onboarding. Khong dung lam nen cho dashboard.
 */

type MeshVariant = "hero" | "band";

export function GradientMesh({
  variant = "hero",
  className,
}: {
  variant?: MeshVariant;
  className?: string;
}): React.ReactElement {
  const blur = variant === "hero" ? 70 : 48;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <svg
        viewBox="0 0 600 800"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <defs>
          <filter id="tf-mesh-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>

        {/* Nen kem am */}
        <rect width="600" height="800" fill="#f7ecd9" />

        <g filter="url(#tf-mesh-blur)">
          {/* Cam sherbet */}
          <ellipse cx="120" cy="90" rx="260" ry="180" fill="#f7b267" opacity="0.85" />
          {/* Kem sang */}
          <ellipse cx="470" cy="60" rx="230" ry="170" fill="#f9e6c6" opacity="0.95" />
          {/* Lavender */}
          <ellipse cx="520" cy="300" rx="280" ry="230" fill="#c9c2fb" opacity="0.9" />
          {/* Indigo — mau thuong hieu, khoi lon nhat */}
          <ellipse cx="240" cy="430" rx="320" ry="260" fill="#533afd" opacity="0.88" />
          <ellipse cx="60" cy="620" rx="240" ry="210" fill="#4434d4" opacity="0.8" />
          {/* Ruby va magenta o day */}
          <ellipse cx="430" cy="690" rx="260" ry="200" fill="#ea2261" opacity="0.72" />
          <ellipse cx="560" cy="780" rx="180" ry="150" fill="#f96bee" opacity="0.55" />
        </g>
      </svg>
    </div>
  );
}
