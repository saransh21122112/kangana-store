"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"

import { billSchema, BILL_CATEGORIES, type BillInput } from "@/lib/validations/bill"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AppleButton } from "@/components/apple/AppleButton"
import { cn } from "@/lib/utils"

/**
 * `billSchema` transforms `date`/`amount` from raw form-input types (string)
 * into `Date`/`number` — same z.input vs. output split CustomerForm uses,
 * for the same reason (keep RHF's fields typed as what the DOM actually
 * produces while `handleSubmit`'s callback gets the transformed output).
 */
type AddBillFormValues = z.input<typeof billSchema>

export interface AddBillFormProps {
  /** The customer this bill is being added for — already known by the caller. */
  customerId: string
  /** Called after a successful submit (e.g. close sheet, refresh, toast). */
  onSuccess?: () => void
}

/** "YYYY-MM-DD" for <input type="date">'s default value (today). */
function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Suggests a bill number like `INV-2026-4821` (current year + a random
 * 4-digit number). Purely a convenience default — fully editable, and not
 * guaranteed unique (the API enforces that and surfaces a clear error if
 * it collides). Deliberately not querying a running sequence count — that
 * would be over-engineering sequencing for what the brief calls a "keep it
 * simple" suggestion.
 */
function suggestBillNo(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(1000 + Math.random() * 9000)
  return `INV-${year}-${random}`
}

/**
 * Bill No. is generated once on mount via useState's lazy initializer
 * (not inline in render) to respect this repo's react-hooks/purity rule
 * around Math.random() in render bodies (see CustomerBadges' precedent).
 */
export function AddBillForm({ customerId, onSuccess }: AddBillFormProps) {
  const [suggestedBillNo] = React.useState(() => suggestBillNo())
  const [category, setCategory] = React.useState<string>(BILL_CATEGORIES[0])
  const [duplicateBillNo, setDuplicateBillNo] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  /**
   * Live category list from Settings, fetched on mount. Falls back to the
   * hardcoded `BILL_CATEGORIES` while loading or if the fetch fails/returns
   * an empty array — this is a real async data fetch (not mount-detection),
   * so a plain useEffect + setState is the correct/allowed pattern here.
   */
  const [liveCategories, setLiveCategories] = React.useState<string[] | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/settings/categories")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { categories?: string[] } | null) => {
        if (cancelled) return
        if (json?.categories && json.categories.length > 0) {
          setLiveCategories(json.categories)
        }
      })
      .catch(() => {
        // Fall back to BILL_CATEGORIES, set below.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const categoryOptions: string[] = liveCategories ?? [...BILL_CATEGORIES]

  // Derived (not effect-synced): if the currently-selected category isn't in
  // whichever list is active (e.g. it was the fallback's first item and the
  // live list loaded without it), fall back to that list's first item. This
  // also handles the initial render before the live list arrives.
  const selectedCategory = categoryOptions.includes(category) ? category : categoryOptions[0]

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddBillFormValues, unknown, BillInput>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      billNo: suggestedBillNo,
      date: todayInputValue(),
      amount: "" as unknown as number,
      category: BILL_CATEGORIES[0],
      customerId,
    },
  })

  const submit = handleSubmit(async (data) => {
    setDuplicateBillNo(false)
    setServerError(null)
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, category: selectedCategory, customerId }),
      })
      const json = await res.json()

      if (res.status === 409) {
        setDuplicateBillNo(true)
        return
      }
      if (!res.ok) {
        setServerError(json.error ?? "Could not add bill. Please try again.")
        return
      }

      onSuccess?.()
    } catch {
      setServerError("Network error. Please try again.")
    }
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="billNo">Bill No.</Label>
        <Input
          id="billNo"
          placeholder="e.g. INV-2026-0001"
          {...register("billNo", { onChange: () => setDuplicateBillNo(false) })}
        />
        {errors.billNo && <p className="text-xs text-danger">{errors.billNo.message}</p>}
        {duplicateBillNo && (
          <p className="text-xs text-danger">A bill with this bill number already exists.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register("date")} />
          {errors.date && <p className="text-xs text-danger">{errors.date.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Amount (₹)</Label>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0.00"
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-xs text-danger">{errors.amount.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Category</Label>
        <Select value={selectedCategory} onValueChange={(val) => setCategory(val as string)}>
          <SelectTrigger id="category" className="w-full">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <AppleButton type="submit" disabled={isSubmitting} className={cn("mt-2")}>
        {isSubmitting ? "Adding..." : "Add Bill"}
      </AppleButton>
    </form>
  )
}
