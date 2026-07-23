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

const VISIT_FREQUENCY_OPTIONS = [
  { value: "1", label: "1 visit" },
  { value: "2-5", label: "2–5 visits" },
  { value: "6+", label: "6+ visits" },
] as const

const FILTER_KEYS = [
  "category",
  "visitFrequency",
  "minSpend",
  "maxSpend",
  "lastVisitFrom",
  "lastVisitTo",
] as const

/**
 * Filter bar for `/customers`, URL-param-driven — same pattern Stage 5's
 * `ListsSegmentedNav` established (a small client component that reads
 * `useSearchParams`/`useRouter` and pushes updated query params, while the
 * page itself stays a server component reading `searchParams`). Presented
 * inside Stage 1's `AppleSheet` (a filter *sheet* rather than an always-
 * visible inline bar) to keep the customers page header uncluttered — the
 * brief offered either as acceptable.
 */
export function CustomerFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState({
    category: searchParams.get("category") ?? "",
    visitFrequency: searchParams.get("visitFrequency") ?? "",
    minSpend: searchParams.get("minSpend") ?? "",
    maxSpend: searchParams.get("maxSpend") ?? "",
    lastVisitFrom: searchParams.get("lastVisitFrom") ?? "",
    lastVisitTo: searchParams.get("lastVisitTo") ?? "",
  })

  const activeCount = FILTER_KEYS.filter((key) => searchParams.get(key)).length

  function openSheet() {
    setDraft({
      category: searchParams.get("category") ?? "",
      visitFrequency: searchParams.get("visitFrequency") ?? "",
      minSpend: searchParams.get("minSpend") ?? "",
      maxSpend: searchParams.get("maxSpend") ?? "",
      lastVisitFrom: searchParams.get("lastVisitFrom") ?? "",
      lastVisitTo: searchParams.get("lastVisitTo") ?? "",
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
        title="Filter Customers"
        description="Narrow down the customer list. Filters combine together."
      >
        <div className="flex flex-col gap-4 px-1 pb-2">
          <div className="flex flex-col gap-1.5">
            <Label>Favourite Category</Label>
            <Select
              value={draft.category || "__any__"}
              onValueChange={(value) =>
                setDraft((d) => ({ ...d, category: value && value !== "__any__" ? value : "" }))
              }
            >
              <SelectTrigger className="w-full">
                {/* base-ui's SelectValue shows the raw `value` string by
                    default (no value->label mapping without an `items` prop
                    on Select or this children-as-function form) — mapped
                    explicitly here so the trigger shows "Any category"
                    instead of the literal sentinel "__any__". */}
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

          <div className="flex flex-col gap-1.5">
            <Label>Visit Frequency</Label>
            <Select
              value={draft.visitFrequency || "__any__"}
              onValueChange={(value) =>
                setDraft((d) => ({ ...d, visitFrequency: value && value !== "__any__" ? value : "" }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any frequency">
                  {(value: string) =>
                    value === "__any__"
                      ? "Any frequency"
                      : (VISIT_FREQUENCY_OPTIONS.find((o) => o.value === value)?.label ?? value)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any frequency</SelectItem>
                {VISIT_FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minSpend">Min Spend (₹)</Label>
              <Input
                id="minSpend"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={draft.minSpend}
                onChange={(e) => setDraft((d) => ({ ...d, minSpend: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxSpend">Max Spend (₹)</Label>
              <Input
                id="maxSpend"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="No limit"
                value={draft.maxSpend}
                onChange={(e) => setDraft((d) => ({ ...d, maxSpend: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastVisitFrom">Last Visit From</Label>
              <Input
                id="lastVisitFrom"
                type="date"
                value={draft.lastVisitFrom}
                onChange={(e) => setDraft((d) => ({ ...d, lastVisitFrom: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastVisitTo">Last Visit To</Label>
              <Input
                id="lastVisitTo"
                type="date"
                value={draft.lastVisitTo}
                onChange={(e) => setDraft((d) => ({ ...d, lastVisitTo: e.target.value }))}
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
