"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AppleCard } from "@/components/apple/AppleCard"
import { AppleBadge } from "@/components/apple/Badge"
import { AppleButton } from "@/components/apple/AppleButton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EditInventoryItemSheet } from "@/components/inventory/EditInventoryItemSheet"
import { StockAdjustControls } from "@/components/inventory/StockAdjustControls"
import { DeleteInventoryItemButton } from "@/components/inventory/DeleteInventoryItemButton"
import type { InventoryItem } from "@/lib/generated/prisma/client"

export interface InventoryTableProps {
  items: InventoryItem[]
  /** Category list, sourced from `AppSettings.categories` — same prop
   * `AddInventoryItemSheet`/`EditInventoryItemSheet` already take, reused
   * here for the bulk-recategorize `<Select>`. */
  categories: string[]
  canMutate: boolean
  isOwner: boolean
}

/**
 * Client-rendered table for `/inventory`, split out of the page (a server
 * component) so it can own row-selection state — same server-fetch-then-
 * client-render split `CustomerListTable` uses. Adds a checkbox column and a
 * bulk recategorize action bar on top of the page's previous plain table.
 */
export function InventoryTable({ items, categories, canMutate, isOwner }: InventoryTableProps) {
  const router = useRouter()
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = React.useState<string>(categories[0] ?? "")
  const [applying, setApplying] = React.useState(false)

  // A selection is only ever valid against the `items` it was made from —
  // reset it whenever the filtered/fetched list changes (new search/filter
  // via the URL, or a `router.refresh()` after a mutation) rather than
  // trying to reconcile stale ids against an unrelated list. Adjusted
  // during render (React's documented "reset state when a prop changes"
  // pattern, using state rather than a ref) so it clears before the
  // stale-selection paint rather than after.
  const [prevItems, setPrevItems] = React.useState(items)
  if (prevItems !== items) {
    setPrevItems(items)
    if (selected.size > 0) {
      setSelected(new Set())
    }
  }

  const allVisibleSelected = items.length > 0 && selected.size === items.length

  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(items.map((item) => item.id)))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function applyBulkCategory() {
    if (selected.size === 0 || !bulkCategory) return
    setApplying(true)
    try {
      const res = await fetch("/api/inventory/bulk-recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), category: bulkCategory }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        toast.error(json?.error ?? "Could not recategorize items. Please try again.")
        return
      }

      const count = selected.size
      toast.success(`${count} item${count === 1 ? "" : "s"} moved to "${bulkCategory}".`)
      setSelected(new Set())
      router.refresh()
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {canMutate && selected.size > 0 && (
        <AppleCard className="flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm font-medium text-foreground">
            {selected.size} selected{allVisibleSelected ? " (all shown)" : ""}
          </span>
          <Select
            value={bulkCategory}
            onValueChange={(value) => setBulkCategory(value ?? "")}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AppleButton onClick={applyBulkCategory} disabled={applying || !bulkCategory}>
            {applying ? "Applying..." : "Apply"}
          </AppleButton>
        </AppleCard>
      )}

      <AppleCard glow className="overflow-x-auto p-0">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              {canMutate && (
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label={`Select all ${items.length} shown`}
                    title={`Select all ${items.length} shown`}
                    className="size-4 rounded border-border"
                  />
                </th>
              )}
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
                  {canMutate && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                        aria-label={`Select ${item.name}`}
                        className="size-4 rounded border-border"
                      />
                    </td>
                  )}
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
                        <EditInventoryItemSheet item={item} categories={categories} />
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
    </div>
  )
}
