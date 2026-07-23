"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Filter, X } from "lucide-react"

import { AppleButton } from "@/components/apple/AppleButton"
import { AppleSheet } from "@/components/apple/AppleSheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { BILL_CATEGORIES } from "@/lib/validations/bill"
import { ICON_PROPS } from "@/lib/icon-map"

const FILTER_KEYS = ["category", "minAmount", "maxAmount", "dateFrom", "dateTo"] as const

/**
 * Filter bar for `/bills`, URL-param-driven — same pattern
 * `CustomerFilterBar` established on `/customers`: a client component
 * reading/pushing `useSearchParams`, presented inside an `AppleSheet`,
 * while the page itself stays a server component reading `searchParams`.
 */
export function BillFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState({
    category: searchParams.get("category") ?? "",
    minAmount: searchParams.get("minAmount") ?? "",
    maxAmount: searchParams.get("maxAmount") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
  })

  const activeCount = FILTER_KEYS.filter((key) => searchParams.get(key)).length

  function openSheet() {
    setDraft({
      category: searchParams.get("category") ?? "",
      minAmount: searchParams.get("minAmount") ?? "",
      maxAmount: searchParams.get("maxAmount") ?? "",
      dateFrom: searchParams.get("dateFrom") ?? "",
      dateTo: searchParams.get("dateTo") ?? "",
    })
    setOpen(true)
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of FILTER_KEYS) {
      const value = draft[key]
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
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
        title="Filter Bills"
        description="Narrow down the bill list. Filters combine together."
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
                {BILL_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minAmount">Min Amount (₹)</Label>
              <Input
                id="minAmount"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={draft.minAmount}
                onChange={(e) => setDraft((d) => ({ ...d, minAmount: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxAmount">Max Amount (₹)</Label>
              <Input
                id="maxAmount"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="No limit"
                value={draft.maxAmount}
                onChange={(e) => setDraft((d) => ({ ...d, maxAmount: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={draft.dateFrom}
                onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={draft.dateTo}
                onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
              />
            </div>
          </div>

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
