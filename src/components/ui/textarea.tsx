import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-input border border-hairline-input bg-white px-3 py-2",
        "text-[15px] text-ink placeholder:text-ink-muted/80",
        "transition-colors outline-none",
        "focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand/40",
        "disabled:cursor-not-allowed disabled:bg-canvas-soft disabled:opacity-60",
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
