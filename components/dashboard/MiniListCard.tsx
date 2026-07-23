import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ChevronRight } from "lucide-react"

import { AppleCard } from "@/components/apple/AppleCard"
import { Avatar } from "@/components/apple/Avatar"
import { EmptyState } from "@/components/apple/EmptyState"
import { ICON_PROPS } from "@/lib/icon-map"

export interface MiniListEntry {
  customer: {
    id: string
    name: string
  }
  /** Days until the next occurrence, 0 = today. */
  daysUntil: number
}

export interface MiniListCardProps {
  title: string
  icon: LucideIcon
  entries: MiniListEntry[]
  viewAllHref: string
  emptyIcon: LucideIcon
  emptyTitle: string
  /** Max rows to show before "View all" takes over — defaults to 5. */
  limit?: number
}

function daysLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Today"
  if (daysUntil === 1) return "Tomorrow"
  return `In ${daysUntil} days`
}

/**
 * Small scrollable card used for the "Birthdays This Week" and
 * "Anniversaries This Week" dashboard sections: top `limit` entries, each
 * showing Avatar/Name/days-until, plus a "View all" link to the full
 * Stage 5 list view.
 */
export function MiniListCard({
  title,
  icon: Icon,
  entries,
  viewAllHref,
  emptyIcon,
  emptyTitle,
  limit = 5,
}: MiniListCardProps) {
  const visible = entries.slice(0, limit)

  return (
    <AppleCard noPadding className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Icon {...ICON_PROPS} size={16} />
          </div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        <Link
          href={viewAllHref}
          className="flex items-center gap-0.5 text-xs font-medium text-accent hover:underline"
        >
          View all
          <ChevronRight {...ICON_PROPS} size={14} />
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} className="py-8" />
      ) : (
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {visible.map(({ customer, daysUntil }) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
            >
              <Avatar name={customer.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {customer.name}
              </span>
              <span className="shrink-0 text-xs font-medium text-vip">{daysLabel(daysUntil)}</span>
            </Link>
          ))}
        </div>
      )}
    </AppleCard>
  )
}
