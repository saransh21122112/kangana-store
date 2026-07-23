"use client"

import * as React from "react"
import { motion, type HTMLMotionProps } from "framer-motion"

import { cn } from "@/lib/utils"

export type AppleButtonVariant = "primary" | "secondary" | "destructive" | "ghost"
export type AppleButtonSize = "sm" | "md" | "lg"

export interface AppleButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: AppleButtonVariant
  size?: AppleButtonSize
}

const variantClasses: Record<AppleButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent/90",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
  destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
  ghost: "bg-transparent text-foreground hover:bg-muted",
}

const sizeClasses: Record<AppleButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
}

/**
 * Apple-style button: rounded-xl, spring hover/tap scale via framer-motion.
 * Built as a standalone primitive (rather than wrapping shadcn's Button)
 * because the base-nova Button uses @base-ui/react's render-prop pattern,
 * which doesn't compose cleanly with motion.button's own element control.
 */
export const AppleButton = React.forwardRef<HTMLButtonElement, AppleButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        whileHover={disabled ? undefined : { scale: 1.02 }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
AppleButton.displayName = "AppleButton"
