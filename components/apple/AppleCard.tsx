import * as React from "react"

import { cn } from "@/lib/utils"

export interface AppleCardProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Removes the default padding, for cards that manage their own spacing. */
  noPadding?: boolean
}

/**
 * The base "raised white surface" used throughout the app: rounded-2xl,
 * a hairline border, and a soft low-opacity shadow. Dark mode swaps in the
 * near-black card surface defined in app/globals.css.
 */
export const AppleCard = React.forwardRef<HTMLDivElement, AppleCardProps>(
  ({ className, noPadding, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-border bg-card text-card-foreground shadow-apple-card",
          !noPadding && "p-5",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
AppleCard.displayName = "AppleCard"
