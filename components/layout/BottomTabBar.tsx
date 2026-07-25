"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { LayoutDashboard, Users, Receipt, MessageCircle, MoreHorizontal, Search, Sun, Moon } from "lucide-react"

import { cn } from "@/lib/utils"
import { ICON_PROPS } from "@/lib/icon-map"
import { useMounted } from "@/lib/use-media-query"
import { SIDEBAR_NAV_ITEMS } from "@/components/layout/Sidebar"
import { openCommandPalette } from "@/components/search/CommandPalette"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const PRIMARY_TABS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Visits", href: "/bills", icon: Receipt },
  { label: "Campaigns", href: "/messages/campaigns", icon: MessageCircle },
]

/** Same VIEWER-hidden labels as Sidebar.tsx — kept in sync manually since
 * this bar duplicates rather than reuses Sidebar's nav-item filtering. */
const VIEWER_HIDDEN_LABELS = new Set(["Settings", "Campaigns"])

/** Same STAFF-hidden labels as Sidebar.tsx — kept in sync manually. */
const STAFF_HIDDEN_LABELS = new Set(["Dashboard", "Reports", "Campaigns"])

export interface BottomTabBarProps {
  className?: string
  /** Current user's role, threaded down from AppShell so VIEWER/STAFF
   * don't see role-restricted items in the primary tabs or "More" sheet. */
  role?: string
}

/**
 * Mobile bottom tab bar: a reduced set of primary destinations plus a
 * "More" tab that opens a sheet with the rest of the sidebar's nav items.
 */
export function BottomTabBar({ className, role }: BottomTabBarProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = React.useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const isViewer = role === "VIEWER"
  const isStaff = role === "STAFF"
  const hiddenLabels = isViewer ? VIEWER_HIDDEN_LABELS : isStaff ? STAFF_HIDDEN_LABELS : null

  const primaryTabs = hiddenLabels
    ? PRIMARY_TABS.filter((tab) => !hiddenLabels.has(tab.label))
    : PRIMARY_TABS

  /** Nav items not in the primary tabs — surfaced in the "More" sheet. */
  const moreItems = SIDEBAR_NAV_ITEMS.filter(
    (item) =>
      !PRIMARY_TABS.some((tab) => tab.href === item.href) &&
      (!hiddenLabels || !hiddenLabels.has(item.label))
  )

  return (
    <>
      <nav
        className={cn(
          "flex h-16 items-center justify-around border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80",
          className
        )}
      >
        {primaryTabs.map((tab) => {
          const isActive = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium",
                isActive ? "text-accent" : "text-muted-foreground"
              )}
            >
              <Icon {...ICON_PROPS} size={22} />
              {tab.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium text-muted-foreground"
        >
          <Search {...ICON_PROPS} size={22} />
          Search
        </button>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium text-muted-foreground"
        >
          <MoreHorizontal {...ICON_PROPS} size={22} />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="flex-row items-center justify-between">
            <SheetTitle>More</SheetTitle>
            <NotificationBell />
          </SheetHeader>
          <div className="flex flex-col gap-1 px-4 pb-4">
            {moreItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <Icon {...ICON_PROPS} />
                  {item.label}
                </Link>
              )
            })}

            {/* Dark mode was previously desktop-Sidebar-only — mobile had
                no way to reach it at all. Same next-themes toggle, same
                pattern as Sidebar.tsx. */}
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun {...ICON_PROPS} />
              ) : (
                <Moon {...ICON_PROPS} />
              )}
              {mounted ? (resolvedTheme === "dark" ? "Light mode" : "Dark mode") : "Theme"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
