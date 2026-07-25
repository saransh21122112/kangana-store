import { Box } from "lucide-react"

import { auth } from "@/lib/auth"
import { getAllInventoryItems } from "@/lib/queries/inventory"
import { getSettings } from "@/lib/queries/settings"
import { AppleCard } from "@/components/apple/AppleCard"
import { AppleBadge } from "@/components/apple/Badge"
import { AuroraBackground } from "@/components/apple/AuroraBackground"
import { EmptyState } from "@/components/apple/EmptyState"
import { InventoryFilterBar } from "@/components/inventory/InventoryFilterBar"
import { AddInventoryItemSheet } from "@/components/inventory/AddInventoryItemSheet"
import { EditInventoryItemSheet } from "@/components/inventory/EditInventoryItemSheet"
import { StockAdjustControls } from "@/components/inventory/StockAdjustControls"
import { DeleteInventoryItemButton } from "@/components/inventory/DeleteInventoryItemButton"

interface InventoryPageProps {
  // Same server-component-reads-searchParams / client-filter-bar-pushes-URL
  // split established by `/customers` (CustomerFilterBar) and `/bills`
  // (BillFilterBar).
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

// See app/(app)/(dashboard)/page.tsx for why this is needed: without it,
// Next statically prerenders this page at build time and new/edited/deleted
// items never show up here on reload in production.
export const dynamic = "force-dynamic"

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const session = await auth()
  const role = session?.user.role
  const isOwner = role === "OWNER"
  const canMutate = role === "OWNER" || role === "STAFF"

  const params = await searchParams
  const category = firstValue(params.category)
  const search = firstValue(params.search)
  const lowStockOnly = firstValue(params.lowStockOnly) === "true"

  // With ~5,300 bulk-imported items, an unfiltered/unsearched listing would
  // render every row at once — cap it and nudge toward search/category
  // filters rather than building full pagination for a page that's mostly
  // used via search anyway (per the bulk-import task's brief).
  const LISTING_CAP = 200
  const [items, settings] = await Promise.all([
    getAllInventoryItems({ category, search, lowStockOnly, limit: LISTING_CAP }),
    getSettings(),
  ])
  const atCap = items.length === LISTING_CAP

  return (
    <div className="relative flex flex-col gap-6">
      <AuroraBackground />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Inventory</h1>
          <div className="gradient-hairline mt-2 h-0.5 w-14 rounded-full" />
          <p className="mt-2 text-sm text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"} matching
            {atCap
              ? ` (showing first ${LISTING_CAP} — narrow your search or add a category filter)`
              : "."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InventoryFilterBar categories={settings.categories} />
          {canMutate && <AddInventoryItemSheet categories={settings.categories} />}
        </div>
      </div>

      {items.length === 0 ? (
        <AppleCard glow>
          <EmptyState
            icon={Box}
            title="No inventory items yet"
            description="Add your first item to start tracking stock levels."
          />
        </AppleCard>
      ) : (
        <AppleCard glow className="overflow-x-auto p-0">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const lowStock = item.quantity <= item.lowStockThreshold
                return (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.brand ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {item.ratePerUnit > 0
                        ? `₹${item.ratePerUnit.toLocaleString("en-IN")} / ${item.unitType}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3">
                      {lowStock && <AppleBadge variant="danger">Low Stock</AppleBadge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canMutate && <StockAdjustControls itemId={item.id} />}
                        {canMutate && (
                          <EditInventoryItemSheet item={item} categories={settings.categories} />
                        )}
                        {isOwner && <DeleteInventoryItemButton itemId={item.id} />}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </AppleCard>
      )}
    </div>
  )
}
