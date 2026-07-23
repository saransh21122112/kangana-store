"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Receipt, MessageCircle, MoreHorizontal, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { ICON_PROPS } from "@/lib/icon-map"
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

/** Nav items not in the primary tabs — surfaced in the "More" sheet. */
const MORE_ITEMS = SIDEBAR_NAV_ITEMS.filter(
  (item) => !PRIMARY_TABS.some((tab) => tab.href === item.href)
)

export interface BottomTabBarProps {
  className?: string
}

/**
 * Mobile bottom tab bar: a reduced set of primary destinations plus a
 * "More" tab that opens a sheet with the rest of the sidebar's nav items.
 */
export function BottomTabBar({ className }: BottomTabBarProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = React.useState(false)

  return (
    <>
      <nav
        className={cn(
          "flex h-16 items-center justify-around border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80",
          className
        )}
      >
        {PRIMARY_TABS.map((tab) => {
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
            {MORE_ITEMS.map((item) => {
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
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
