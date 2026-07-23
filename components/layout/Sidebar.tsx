"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Receipt,
  MessageCircle,
  ListChecks,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  LogOut,
  Search,
} from "lucide-react"
import { useTheme } from "next-themes"
import { signOut } from "next-auth/react"

import { cn } from "@/lib/utils"
import { ICON_PROPS } from "@/lib/icon-map"
import { useMounted } from "@/lib/use-media-query"
import { AddBillGlobalSheet } from "@/components/bills/AddBillGlobalSheet"
import { openCommandPalette } from "@/components/search/CommandPalette"
import { NotificationBell } from "@/components/notifications/NotificationBell"

export interface SidebarNavItem {
  label: string
  href: string
  icon: React.ElementType
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Visits/Bills", href: "/bills", icon: Receipt },
  { label: "Campaigns", href: "/messages/campaigns", icon: MessageCircle },
  { label: "Lists", href: "/lists", icon: ListChecks },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
]

export interface SidebarProps {
  className?: string
}

/**
 * Persistent, collapsible left sidebar shown at desktop breakpoints
 * (see AppShell, which hides this below `md` in favor of BottomTabBar).
 */
export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-64",
        className
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4">
        {!collapsed && (
          <span className="flex-1 truncate text-sm font-semibold tracking-tight text-foreground">
            Kangna CRM
          </span>
        )}
        <button
          type="button"
          onClick={openCommandPalette}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "mx-auto"
          )}
          title="Search (⌘K)"
          aria-label="Search customers"
        >
          <Search {...ICON_PROPS} size={18} />
        </button>
        {!collapsed && <NotificationBell />}
      </div>

      <div className="px-2">
        <AddBillGlobalSheet
          trigger={
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white shadow-apple-card transition-opacity hover:opacity-90",
                collapsed && "justify-center px-0"
              )}
              title="Add Bill"
            >
              <Receipt {...ICON_PROPS} size={18} className="shrink-0" />
              {!collapsed && <span>Add Bill</span>}
            </button>
          }
        />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {SIDEBAR_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon {...ICON_PROPS} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-border px-2 py-2">
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
          title="Toggle dark mode"
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun {...ICON_PROPS} className="shrink-0" />
          ) : (
            <Moon {...ICON_PROPS} className="shrink-0" />
          )}
          {!collapsed && <span>{mounted ? (resolvedTheme === "dark" ? "Light mode" : "Dark mode") : "Theme"}</span>}
        </button>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight {...ICON_PROPS} className="shrink-0" />
          ) : (
            <ChevronLeft {...ICON_PROPS} className="shrink-0" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-danger",
            collapsed && "justify-center px-0"
          )}
          title="Sign out"
        >
          <LogOut {...ICON_PROPS} className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}
