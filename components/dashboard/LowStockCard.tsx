import Link from "next/link"
import { Box, ChevronRight, PackageX } from "lucide-react"

import { AppleCard } from "@/components/apple/AppleCard"
import { EmptyState } from "@/components/apple/EmptyState"
import { ICON_PROPS } from "@/lib/icon-map"

export interface LowStockCardItem {
  id: string
  name: string
  category: string
  quantity: number
  lowStockThreshold: number
}

export interface LowStockCardProps {
  items: LowStockCardItem[]
  /** Max rows to show before "View all" takes over — defaults to 5, same
   * convention as `MiniListCard`. */
  limit?: number
}

/**
 * Dashboard "Low Stock" card — mirrors `NeedsAttentionCard`'s simple-list
 * chrome (icon + title + rows), fed by `getLowStockItems()`
 * (`lib/queries/inventory.ts`). Exists specifically so the inventory
 * feature's `lowStockThreshold` field is actually load-bearing rather than
 * stored-but-unused — see `MEMORY.md`'s note on `AppSettings`'s inactive-
 * customer thresholds having exactly that unused-field problem previously.
 */
export function LowStockCard({ items, limit = 5 }: LowStockCardProps) {
  const visible = items.slice(0, limit)

  return (
    <AppleCard noPadding className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
            <Box {...ICON_PROPS} size={16} />
          </div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Low Stock</h2>
        </div>
        <Link
          href="/inventory?lowStockOnly=true"
          className="flex items-center gap-0.5 text-xs font-medium text-accent hover:underline"
        >
          View all
          <ChevronRight {...ICON_PROPS} size={14} />
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={PackageX} title="Nothing low on stock" className="py-8" />
      ) : (
        <div className="flex flex-col gap-1">
          {visible.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.category}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold text-danger">
                {item.quantity} left
              </span>
            </div>
          ))}
        </div>
      )}
    </AppleCard>
  )
}
