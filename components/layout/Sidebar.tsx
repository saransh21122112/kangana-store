"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Receipt,
  MessageCircle,
  ListChecks,
  Box,
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
  { label: "Inventory", href: "/inventory", icon: Box },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
]

export interface SidebarProps {
  className?: string
  /** Current user's role, threaded down from the server-component parent
   * (AppShell -> app/(app)/layout.tsx's `auth()` call) so Sidebar can hide
   * nav entries VIEWER shouldn't see, without a client-side useSession()
   * call — mirrors SettingsTabs's prop-driven-filter style. */
  role?: string
}

/** Nav item labels hidden entirely for VIEWER — read-only role has no
 * legitimate use for Settings or Messages/Campaigns. */
const VIEWER_HIDDEN_LABELS = new Set(["Settings", "Campaigns"])

/** Nav item labels hidden entirely for STAFF — narrowed to a data-entry
 * role (add/edit customers, add bills) with no access to store-wide
 * analytics (Dashboard, Reports) or messaging (Campaigns/send). */
const STAFF_HIDDEN_LABELS = new Set(["Dashboard", "Reports", "Campaigns"])

/**
 * Persistent, collapsible left sidebar shown at desktop breakpoints
 * (see AppShell, which hides this below `md` in favor of BottomTabBar).
 */
export function Sidebar({ className, role }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const isViewer = role === "VIEWER"
  const isStaff = role === "STAFF"
  const hiddenLabels = isViewer ? VIEWER_HIDDEN_LABELS : isStaff ? STAFF_HIDDEN_LABELS : null
  const navItems = hiddenLabels
    ? SIDEBAR_NAV_ITEMS.filter((item) => !hiddenLabels.has(item.label))
    : SIDEBAR_NAV_ITEMS
  // Defaults to "Ctrl+K" (correct pre-hydration and for the majority of
  // users) and only switches to the Mac glyph once mounted, so Windows/
  // Linux users never see a misleading ⌘ hint — the keydown handler itself
  // already accepts both metaKey and ctrlKey, this is display-only.
  const searchShortcutLabel = mounted && navigator.platform.toUpperCase().includes("MAC") ? "⌘K" : "Ctrl+K"

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
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
            <Image
              src="/kangna-logo-mark.png"
              alt="Kangna"
              width={348}
              height={159}
              className="h-7 w-auto shrink-0 rounded-sm bg-white p-0.5"
              priority
            />
            <span className="truncate text-xs font-medium tracking-wide text-muted-foreground">
              CRM
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={openCommandPalette}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "mx-auto"
          )}
          title={`Search (${searchShortcutLabel})`}
          aria-label="Search customers"
        >
          <Search {...ICON_PROPS} size={18} />
        </button>
        {!collapsed && <NotificationBell />}
      </div>

      {!isViewer && (
        <div className="px-2">
          <AddBillGlobalSheet
            trigger={
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-foreground shadow-apple-card transition-opacity hover:opacity-90",
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
      )}

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {navItems.map((item) => {
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
