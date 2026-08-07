"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { EMPLOYEE_NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Thanh dieu huong duoi cung cua man hinh nhan vien.
 * Moi muc cao toi thieu 44px va co dem vung an toan cho iPhone.
 *
 * So cot LAY TU DO DAI cua `EMPLOYEE_NAV_ITEMS`, khong viet cung: truoc PAY-05
 * o day la `grid-cols-4`, va them mot muc vao mang thi thanh nav am tham vo bo
 * cuc ma khong mot cho nao bao loi.
 */
const COLUMN_CLASS: Record<number, string> = {
  4: "grid-cols-4",
  5: "grid-cols-5",
};
export function MobileBottomNav(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Điều hướng nhân viên"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-hairline bg-white/97 backdrop-blur"
    >
      <ul
        className={cn(
          "grid",
          COLUMN_CLASS[EMPLOYEE_NAV_ITEMS.length] ?? "grid-cols-5",
        )}
      >
        {EMPLOYEE_NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/employee"
              ? pathname === "/employee"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors",
                  isActive ? "font-medium text-brand" : "text-ink-muted",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn("size-5", isActive && "stroke-[2.2]")}
                />
                {/* `truncate` vi voi nam cot tren may 320px moi o chi con
                    ~56px — "Phiếu lương" vua khit. Cat gon van doc duoc; tran
                    ra ngoai thi lam lech ca thanh nav. */}
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
