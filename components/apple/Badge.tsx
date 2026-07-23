import * as React from "react"

import { cn } from "@/lib/utils"

export type BadgeVariant = "vip" | "new" | "inactive" | "success" | "danger" | "neutral"

export interface AppleBadgeProps extends React.ComponentPropsWithoutRef<"span"> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  vip: "bg-vip/15 text-vip",
  new: "bg-accent/15 text-accent",
  inactive: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  danger: "bg-danger/15 text-danger",
  neutral: "bg-muted text-muted-foreground",
}

/** Pill-shaped status badge, e.g. VIP / New / Inactive customer labels. */
export const AppleBadge = React.forwardRef<HTMLSpanElement, AppleBadgeProps>(
  ({ className, variant = "neutral", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    )
  }
)
AppleBadge.displayName = "AppleBadge"
