"use client"

import * as React from "react"
import { Bell, PartyPopper, Heart, Star, AlertTriangle, Box, CheckCheck } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { cn } from "@/lib/utils"
import { ICON_PROPS } from "@/lib/icon-map"
import { EmptyState } from "@/components/apple/EmptyState"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface OwnerNotificationDTO {
  id: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
}

/**
 * Picks an icon based on the `type` string's prefix (see
 * lib/queries/notifications.ts's dedupe-key scheme — `type` is always
 * `"<kind>:<id>"`, where `id` is a customer id for every kind except
 * `low-stock:`, whose id is an `InventoryItem` id). Falls back to the
 * generic bell icon for anything unrecognized.
 */
function iconForType(type: string) {
  if (type.startsWith("birthday:")) return PartyPopper
  if (type.startsWith("anniversary:")) return Heart
  if (type.startsWith("vip-top10:")) return Star
  if (type.startsWith("inactive-")) return AlertTriangle
  if (type.startsWith("low-stock:")) return Box
  return Bell
}

/**
 * Best-effort deep link for a notification. `type` embeds an id after the
 * first `:`, which is a customer id for every kind the cron route creates
 * except `low-stock:` — that id is an `InventoryItem` id, and there's no
 * per-item detail page, so it links to the filtered inventory list instead
 * of guessing a `/inventory/<id>` route that doesn't exist. Any other
 * `type` that doesn't follow the `"<kind>:<id>"` shape (shouldn't happen
 * given this stage's own cron route, but kept defensive for forward-
 * compatibility) falls back to `/lists` rather than guessing.
 */
function linkForNotification(type: string): string {
  if (type.startsWith("low-stock:")) return "/inventory?lowStockOnly=true"
  const separatorIndex = type.indexOf(":")
  if (separatorIndex === -1) return "/lists"
  const customerId = type.slice(separatorIndex + 1)
  return customerId ? `/customers/${customerId}` : "/lists"
}

/**
 * Bell icon with an unread-count badge, dropdown listing recent
 * notifications, click-through deep link per row, and a "mark all read"
 * action. Mounted in the Sidebar (desktop) — see components/layout/Sidebar.tsx.
 */
export function NotificationBell() {
  const [notifications, setNotifications] = React.useState<OwnerNotificationDTO[]>([])
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  async function fetchNotifications() {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) {
        const data = (await res.json()) as { notifications: OwnerNotificationDTO[] }
        setNotifications(data.notifications)
      }
    } finally {
      setLoading(false)
    }
  }

  // Fetch once on mount so the badge count is correct without opening the
  // dropdown first, and again every time the dropdown opens (fresh data).
  // Wrapped in a `void`-called nested async function (not calling
  // `fetchNotifications()`'s own `setLoading(true)` directly at the top of
  // the effect body) — same pattern SendMessageSheet.tsx established to
  // satisfy this repo's `react-hooks/set-state-in-effect` ESLint rule.
  React.useEffect(() => {
    let cancelled = false

    async function loadOnMount() {
      setLoading(true)
      try {
        const res = await fetch("/api/notifications")
        if (cancelled) return
        if (res.ok) {
          const data = (await res.json()) as { notifications: OwnerNotificationDTO[] }
          setNotifications(data.notifications)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadOnMount()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) await fetchNotifications()
  }

  async function handleMarkAllRead() {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    }
  }

  async function handleMarkOneRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      {/* base-ui's Trigger already renders a native <button> — no `asChild`
          prop exists here (base-ui uses a `render` prop instead, per Stage
          1's notes), so className/children are passed directly rather than
          wrapping in a second <button>. */}
      <DropdownMenuTrigger
        className="relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell {...ICON_PROPS} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-danger-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80"
            >
              <CheckCheck {...ICON_PROPS} size={14} />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {!loading && notifications.length === 0 && (
            <div className="px-2 py-6">
              <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
            </div>
          )}

          {notifications.map((notification) => {
            const Icon = iconForType(notification.type)
            return (
              <a
                key={notification.id}
                href={linkForNotification(notification.type)}
                onClick={() => {
                  if (!notification.isRead) handleMarkOneRead(notification.id)
                }}
                className={cn(
                  "flex items-start gap-3 rounded-xl px-2 py-2.5 text-sm transition-colors hover:bg-muted",
                  !notification.isRead && "bg-accent/5"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                    notification.isRead ? "bg-muted text-muted-foreground" : "bg-accent/15 text-accent"
                  )}
                >
                  <Icon {...ICON_PROPS} size={16} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("text-foreground", !notification.isRead && "font-medium")}>
                    {notification.message}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </span>
                </div>
                {!notification.isRead && (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                )}
              </a>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
