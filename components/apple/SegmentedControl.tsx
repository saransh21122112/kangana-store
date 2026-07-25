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
 *
 * `overflowLeft`/`overflowRight` track whether there's more content
 * scrolled out of view on each side, driving a fade mask at that edge —
 * a real bug, reported via a mobile screenshot: a partially-scrolled tab
 * strip hard-clipped a tab's label mid-letter with no visual cue that it
 * was scrollable, reading as broken/glitchy text rather than "swipe for
 * more". Computed via scroll/resize listeners rather than applied
 * unconditionally, so a control that fits without scrolling (the common
 * case — most of this app's SegmentedControls have only 2-3 options)
 * never gets a pointless fade on its first/last tab.
 *
 * The fade alone turned out not to be enough — reported again, still
 * showing a readable-but-truncated word (e.g. "nactive") resting at the
 * edge after a scroll gesture ends. `scroll-snap` addresses the actual
 * root cause rather than just dressing it up: `snap-x snap-mandatory` on
 * the scroll container plus `snap-start` on each tab makes a touch/wheel
 * scroll always settle with a *whole* tab flush against the edge, so the
 * strip can no longer come to rest mid-label at all. The fade mask stays
 * as a secondary cue for the brief moment while actively dragging between
 * snap points.
 */
export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [overflowLeft, setOverflowLeft] = React.useState(false)
  const [overflowRight, setOverflowRight] = React.useState(false)

  const updateOverflow = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setOverflowLeft(el.scrollLeft > 1)
    setOverflowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }, [])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateOverflow()

    const resizeObserver = new ResizeObserver(updateOverflow)
    resizeObserver.observe(el)
    el.addEventListener("scroll", updateOverflow, { passive: true })
    return () => {
      resizeObserver.disconnect()
      el.removeEventListener("scroll", updateOverflow)
    }
    // Re-measure whenever the option set changes (e.g. Settings' Users tab
    // appearing/disappearing based on role).
  }, [updateOverflow, options.length])

  return (
    <div
      ref={scrollRef}
      className={cn(
        "no-scrollbar max-w-full snap-x snap-mandatory overflow-x-auto scroll-smooth",
        overflowLeft && overflowRight
          ? "[mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)]"
          : overflowLeft
            ? "[mask-image:linear-gradient(to_right,transparent,black_20px)]"
            : overflowRight
              ? "[mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent)]"
              : undefined,
        className
      )}
    >
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
                "relative z-10 shrink-0 snap-start rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
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
