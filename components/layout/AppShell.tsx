import * as React from "react"

import { Sidebar } from "@/components/layout/Sidebar"
import { BottomTabBar } from "@/components/layout/BottomTabBar"

export interface AppShellProps {
  children: React.ReactNode
  /** Current user's role, threaded down from app/(app)/layout.tsx's
   * `auth()` call so Sidebar can hide role-restricted nav entries. */
  role?: string
}

/**
 * Responsive app frame: a persistent Sidebar on desktop (`md:` and up),
 * a fixed BottomTabBar on mobile. Both are always mounted — visibility is
 * controlled purely with Tailwind breakpoints, so there's no layout jump
 * or hydration mismatch when resizing.
 *
 * `overflow-clip` (not `overflow-hidden`) on both this outer shell and
 * `<main>`'s horizontal axis — real bug, reported via a mobile screenshot:
 * `overflow: hidden` still creates a *scrollable* overflow region (its
 * `scrollLeft` is programmatically settable, and critically, it's a valid
 * target for the browser's native "scroll the focused/tapped element into
 * view" behavior). On iOS Safari, tapping something whose layout briefly
 * extends past the viewport (e.g. a wide child before it reflows, or any
 * future off-screen-until-scrolled element) made the browser scroll this
 * ancestor's `scrollLeft`, shifting the *entire app* sideways — sidebar,
 * bottom tab bar, everything. `overflow: clip` still clips visually
 * exactly like `hidden` did, but never establishes a scrollable region at
 * all, so there is no `scrollLeft` for any focus-scroll behavor to hijack.
 * `<main>` additionally needs its horizontal axis pinned explicitly to
 * `clip` (not left as the default) — per the CSS Overflow spec, an element
 * with `overflow-y: auto` and no explicit `overflow-x` computes its
 * horizontal axis to `auto` too (not `visible`), which would make `<main>`
 * itself a second horizontally-scrollable ancestor for the same bug.
 */
export function AppShell({ children, role }: AppShellProps) {
  return (
    <div className="flex h-dvh w-full overflow-clip bg-background">
      <div className="hidden md:block">
        <Sidebar role={role} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-x-clip overflow-y-auto pb-16 md:pb-0">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>

        <div className="fixed inset-x-0 bottom-0 md:hidden">
          <BottomTabBar role={role} />
        </div>
      </div>
    </div>
  )
}
