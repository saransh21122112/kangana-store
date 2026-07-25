import { Box } from "lucide-react"

import { auth } from "@/lib/auth"
import { getAllInventoryItems, getDistinctBrands } from "@/lib/queries/inventory"
import { getSettings } from "@/lib/queries/settings"
import { AppleCard } from "@/components/apple/AppleCard"
import { AuroraBackground } from "@/components/apple/AuroraBackground"
import { EmptyState } from "@/components/apple/EmptyState"
import { InventoryFilterBar } from "@/components/inventory/InventoryFilterBar"
import { AddInventoryItemSheet } from "@/components/inventory/AddInventoryItemSheet"
import { InventoryTable } from "@/components/inventory/InventoryTable"
import { ImportInventoryButton } from "@/components/inventory/ImportInventoryButton"

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
  const brand = firstValue(params.brand)
  const search = firstValue(params.search)
  const lowStockOnly = firstValue(params.lowStockOnly) === "true"

  // With ~5,300 bulk-imported items, an unfiltered/unsearched listing would
  // render every row at once — cap it and nudge toward search/category
  // filters rather than building full pagination for a page that's mostly
  // used via search anyway (per the bulk-import task's brief).
  const LISTING_CAP = 200
  const [items, settings, brands] = await Promise.all([
    getAllInventoryItems({ category, brand, search, lowStockOnly, limit: LISTING_CAP }),
    getSettings(),
    getDistinctBrands(),
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
          <InventoryFilterBar categories={settings.categories} brands={brands} />
          {isOwner && <ImportInventoryButton />}
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
        <InventoryTable
          items={items}
          categories={settings.categories}
          canMutate={canMutate}
          isOwner={isOwner}
        />
      )}
    </div>
  )
}
