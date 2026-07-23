import * as React from "react"

import { cn } from "@/lib/utils"

export interface AppleAvatarProps {
  name: string
  size?: "sm" | "default" | "lg"
  className?: string
}

/** Deterministic hash of a string into a positive integer. */
function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Palette chosen to be legible with white text and to feel at home next to
 * the Apple accent/status colors, without being the same jarring hues.
 */
const PALETTE = [
  "#0A84FF",
  "#34C759",
  "#FF9F0A",
  "#FF3B30",
  "#AF52DE",
  "#FF2D55",
  "#5AC8FA",
  "#FFD60A",
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const sizeClasses = {
  sm: "size-6 text-xs",
  default: "size-8 text-sm",
  lg: "size-10 text-base",
}

/**
 * Initials-based avatar with a background color deterministically hashed
 * from the customer's name (same name always renders the same color).
 */
export function Avatar({ name, size = "default", className }: AppleAvatarProps) {
  const color = PALETTE[hashString(name) % PALETTE.length]
  const initials = getInitials(name)

  return (
    <div
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  )
}
