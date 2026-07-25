"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

export interface SegmentedControlOption {
  value: string
  label: string
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * iOS-style segmented control / tab switcher. Fully controlled: the parent
 * owns `value` and receives changes via `onChange`.
 *
 * Wrapped in its own `overflow-x-auto` container (scrollbar hidden via
 * `.no-scrollbar`, but still touch/wheel-scrollable) — with 5+ options or
 * long labels (Settings' tabs, `/lists`' view switcher) the row can be
 * wider than a narrow phone screen; without this the row's `inline-flex`
 * just overflows its parent and drags the *whole page* into horizontal
 * scroll instead of scrolling only the tab strip itself.
 */
export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  return (
    <div className={cn("no-scrollbar max-w-full overflow-x-auto", className)}>
      <div
        role="tablist"
        className="relative inline-flex items-center gap-0.5 rounded-xl bg-muted p-1"
      >
        {options.map((option) => {
          const isActive = option.value === value
          return (
            <button
              key={option.value}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative z-10 shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="segmented-control-active"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className="absolute inset-0 -z-10 rounded-lg bg-card shadow-apple-card"
                />
              )}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
