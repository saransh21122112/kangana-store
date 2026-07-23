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
 */
export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-xl bg-muted p-1",
        className
      )}
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
              "relative z-10 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
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
  )
}
