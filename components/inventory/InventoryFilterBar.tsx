"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Filter, Search, X } from "lucide-react"

import { AppleButton } from "@/components/apple/AppleButton"
import { AppleSheet } from "@/components/apple/AppleSheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ICON_PROPS } from "@/lib/icon-map"

const FILTER_KEYS = ["category", "brand", "lowStockOnly"] as const

export interface InventoryFilterBarProps {
  /** Category list, sourced from `AppSettings.categories` (same list
   * `AddInventoryItemSheet` uses), fetched server-side by the page. */
  categories: string[]
  /** Distinct `brand` values across the catalog, sourced live from the DB
   * (via `getDistinctBrands`) rather than a settings-managed list — unlike
   * categories, brands aren't curated anywhere. */
  brands: string[]
}

/**
 * Filter bar for `/inventory`, URL-param-driven — mirrors `BillFilterBar`'s
 * pattern exactly: a client component reading/pushing `useSearchParams`,
 * presented inside an `AppleSheet`, while the page itself stays a server
 * component reading `searchParams`.
 */
export function InventoryFilterBar({ categories, brands }: InventoryFilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState({
    category: searchParams.get("category") ?? "",
    brand: searchParams.get("brand") ?? "",
    lowStockOnly: searchParams.get("lowStockOnly") === "true",
  })

  const [searchDraft, setSearchDraft] = React.useState(searchParams.get("search") ?? "")

  const activeCount = FILTER_KEYS.filter((key) => searchParams.get(key)).length

  // Debounced so typing doesn't push a new URL/re-fetch on every keystroke —
  // this filters across ~5,300 bulk-imported items via the server query, so
  // each push is a real round-trip, not free client-side filtering.
  React.useEffect(() => {
    const trimmed = searchDraft.trim()
    const current = searchParams.get("search") ?? ""
    if (trimmed === current) return
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (trimmed) {
        params.set("search", trimmed)
      } else {
        params.delete("search")
      }
      router.push(`${pathname}?${params.toString()}`)
    }, 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on searchDraft only; pathname/router/searchParams are stable per-render refs, not reactive inputs
  }, [searchDraft])

  function openSheet() {
    setDraft({
      category: searchParams.get("category") ?? "",
      brand: searchParams.get("brand") ?? "",
      lowStockOnly: searchParams.get("lowStockOnly") === "true",
    })
    setOpen(true)
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString())
    if (draft.category) {
      params.set("category", draft.category)
    } else {
      params.delete("category")
    }
    if (draft.brand) {
      params.set("brand", draft.brand)
    } else {
      params.delete("brand")
    }
    if (draft.lowStockOnly) {
      params.set("lowStockOnly", "true")
    } else {
      params.delete("lowStockOnly")
    }
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of FILTER_KEYS) params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  return (
    <>
      <div className="relative">
        <Search
          {...ICON_PROPS}
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search name or brand…"
          className="w-56 pl-9"
        />
      </div>

      <AppleButton variant="secondary" onClick={openSheet}>
        <Filter {...ICON_PROPS} size={18} />
        Filters
        {activeCount > 0 && (
          <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {activeCount}
          </span>
        )}
      </AppleButton>

      <AppleSheet
        open={open}
        onOpenChange={setOpen}
        title="Filter Inventory"
        description="Narrow down the item list. Filters combine together."
      >
        <div className="flex flex-col gap-4 px-1 pb-2">
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select
              value={draft.category || "__any__"}
              onValueChange={(value) =>
                setDraft((d) => ({ ...d, category: value && value !== "__any__" ? value : "" }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any category">
                  {(value: string) => (value === "__any__" ? "Any category" : value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any category</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Brand</Label>
            <Select
              value={draft.brand || "__any__"}
              onValueChange={(value) =>
                setDraft((d) => ({ ...d, brand: value && value !== "__any__" ? value : "" }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any brand">
                  {(value: string) => (value === "__any__" ? "Any brand" : value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any brand</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={draft.lowStockOnly}
              onChange={(e) => setDraft((d) => ({ ...d, lowStockOnly: e.target.checked }))}
              className="size-4 rounded border-border"
            />
            Low stock only
          </label>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <X {...ICON_PROPS} size={14} />
              Clear all
            </button>
            <AppleButton onClick={applyFilters}>Apply Filters</AppleButton>
          </div>
        </div>
      </AppleSheet>
    </>
  )
}
