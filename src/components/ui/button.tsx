import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Nut theo dac ta thiet ke:
 * - Nut chinh: pill indigo day, moi khu vuc chi nen co mot nut nay.
 * - Nut phu: nen trang, vien indigo, cung hinh pill.
 * - Hanh dong nguy hiem: mau do semantic, khong dung indigo.
 * - Kich thuoc "mobile" cao 44px cho man hinh cam tay.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-medium transition-colors",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-brand text-white hover:bg-brand-deep active:bg-brand-press",
        secondary:
          "rounded-full border border-brand bg-white text-brand hover:bg-brand-wash active:bg-brand-subdued/50",
        outline:
          "rounded-full border border-hairline bg-white text-ink-secondary hover:bg-canvas-soft hover:text-ink",
        ghost: "rounded-control text-ink-secondary hover:bg-canvas-soft hover:text-ink",
        subtle:
          "rounded-full bg-brand-wash text-brand-deep hover:bg-brand-subdued/60",
        destructive:
          "rounded-full bg-danger text-white hover:bg-danger/90 focus-visible:outline-danger",
        "destructive-outline":
          "rounded-full border border-danger-border bg-white text-danger hover:bg-danger-soft focus-visible:outline-danger",
        onDark:
          "rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-white",
        link: "rounded-sm text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-9 gap-1.5 px-3.5 text-[13px] has-[>svg]:px-3",
        lg: "h-11 px-6 text-[15px]",
        /** Toi thieu 44px — dung cho toan bo giao dien nhan vien tren dien thoai */
        mobile: "h-11 min-h-11 w-full px-5 text-[15px]",
        icon: "size-10 rounded-full",
        "icon-sm": "size-9 rounded-full",
        "icon-mobile": "size-11 min-h-11 min-w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
