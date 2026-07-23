import * as React from "react"

import { Sidebar } from "@/components/layout/Sidebar"
import { BottomTabBar } from "@/components/layout/BottomTabBar"

export interface AppShellProps {
  children: React.ReactNode
}

/**
 * Responsive app frame: a persistent Sidebar on desktop (`md:` and up),
 * a fixed BottomTabBar on mobile. Both are always mounted — visibility is
 * controlled purely with Tailwind breakpoints, so there's no layout jump
 * or hydration mismatch when resizing.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>

        <div className="fixed inset-x-0 bottom-0 md:hidden">
          <BottomTabBar />
        </div>
      </div>
    </div>
  )
}
