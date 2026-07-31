import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClass: Record<AvatarSize, string> = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
};

/**
 * Anh dai dien nhan vien. Khi chua co anh, hien chu cai dau cua ho ten
 * tren nen indigo nhat — mau on dinh theo ten nen khong nhay giua cac lan render.
 */
export function EmployeeAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}): React.ReactElement {
  return (
    <Avatar className={cn("shrink-0", sizeClass[size], className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-brand-wash font-medium text-brand-deep">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
