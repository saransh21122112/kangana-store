"use client"

import * as React from "react"
import {
  useForm,
  useFieldArray,
  useWatch,
  Controller,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
  type FieldErrors,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Search, Trash2, X } from "lucide-react"
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
import { ICON_PROPS } from "@/lib/icon-map"

/**
 * `billSchema` transforms `date` (and each line item's numeric-ish fields)
 * from raw form-input types (strings) into their parsed output types — same
 * z.input vs. output split CustomerForm/the old single-line-item version of
 * this form used, for the same reason (keep RHF's fields typed as what the
 * DOM actually produces while `handleSubmit`'s callback gets the transformed
 * output).
 */
type AddBillFormValues = z.input<typeof billSchema>
type LineItemFormValues = AddBillFormValues["lineItems"][number]
type LineItemErrors = FieldErrors<LineItemFormValues> | undefined

/**
 * Minimal shape needed from `GET /api/inventory` — `lib/queries/inventory.ts`
 * doesn't export a dedicated DTO type (it returns the Prisma-generated
 * `InventoryItem[]` directly), so this is a small local type covering just
 * the fields this form displays/uses rather than importing the Prisma
 * client's generated type into a client component.
 */
interface InventoryItemOption {
  id: string
  name: string
  brand: string | null
  category: string
  unitType: string
  ratePerUnit: number
  quantity: number
}

/** Which of `unitPrice`/`lineTotal` a given row is currently using — purely
 * UI state (not part of `billSchema`), one entry per row, kept in lockstep
 * with the field array's `fields` by index. */
type PriceMode = "unitPrice" | "lineTotal"

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

/** A fresh, empty line item row — quantity defaults to 1, no price entered
 * yet (the user must fill in whichever of unitPrice/lineTotal their row's
 * toggle is set to before the row validates). */
function emptyLineItem(defaultCategory: string): LineItemFormValues {
  return {
    category: defaultCategory,
    quantity: 1,
  } as LineItemFormValues
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Bill No. is generated once on mount via useState's lazy initializer
 * (not inline in render) to respect this repo's react-hooks/purity rule
 * around Math.random() in render bodies (see CustomerBadges' precedent).
 *
 * The form is now a "shopping cart" editor: `lineItems` is a
 * `useFieldArray`-managed dynamic list, each row independently choosing a
 * category, an optional linked inventory item scoped to that category, a
 * quantity, and either a per-item price or a flat line total (never both —
 * `billSchema`'s `superRefine` rejects sending both).
 */
export function AddBillForm({ customerId, onSuccess }: AddBillFormProps) {
  const [suggestedBillNo] = React.useState(() => suggestBillNo())
  const [duplicateBillNo, setDuplicateBillNo] = React.useState(false)
  const [insufficientStock, setInsufficientStock] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  /**
   * Live category list from Settings, fetched once on mount. Falls back to
   * the hardcoded `BILL_CATEGORIES` while loading or if the fetch fails/
   * returns an empty array. Shared across every row rather than refetched
   * per-row on every keystroke.
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

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AddBillFormValues, unknown, BillInput>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      billNo: suggestedBillNo,
      date: todayInputValue(),
      customerId,
      lineItems: [emptyLineItem(BILL_CATEGORIES[0])],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" })

  // One price-mode entry per row, kept in lockstep with `fields` by index —
  // this is UI-only state (which single input a row is showing), not part
  // of `billSchema`, so it lives outside RHF rather than as a registered
  // field.
  const [priceModes, setPriceModes] = React.useState<PriceMode[]>(["unitPrice"])

  function handleAppend() {
    append(emptyLineItem(categoryOptions[0] ?? BILL_CATEGORIES[0]))
    setPriceModes((prev) => [...prev, "unitPrice"])
  }

  function handleRemove(index: number) {
    remove(index)
    setPriceModes((prev) => prev.filter((_, i) => i !== index))
  }

  const watchedLineItems = useWatch({ control, name: "lineItems" })

  // Live-computed running total: sum of each row's current amount (unit
  // price × quantity, or the entered line total, whichever the row is
  // using). Read-only display only — never submitted; the server always
  // recomputes the authoritative total from what's actually submitted.
  const runningTotal = React.useMemo(() => {
    return (watchedLineItems ?? []).reduce((sum: number, item, index) => {
      const mode = priceModes[index] ?? "unitPrice"
      if (mode === "lineTotal") {
        const total = Number(item?.lineTotal)
        return sum + (Number.isFinite(total) ? total : 0)
      }
      const unitPrice = Number(item?.unitPrice)
      const quantity = Number(item?.quantity) || 0
      return sum + (Number.isFinite(unitPrice) ? unitPrice * quantity : 0)
    }, 0)
  }, [watchedLineItems, priceModes])

  const submit = handleSubmit(async (data) => {
    setDuplicateBillNo(false)
    setInsufficientStock(false)
    setServerError(null)
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billNo: data.billNo,
          date: data.date,
          customerId,
          lineItems: data.lineItems.map((li, index) => {
            const mode = priceModes[index] ?? "unitPrice"
            return {
              category: li.category,
              quantity: li.quantity,
              ...(li.inventoryItemId ? { inventoryItemId: li.inventoryItemId } : {}),
              ...(mode === "unitPrice"
                ? { unitPrice: li.unitPrice }
                : { lineTotal: li.lineTotal }),
            }
          }),
        }),
      })
      const json = await res.json()

      if (res.status === 409) {
        if (json.reason === "insufficient_stock") {
          setInsufficientStock(true)
        } else {
          setDuplicateBillNo(true)
        }
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" {...register("date")} />
        {errors.date && <p className="text-xs text-danger">{errors.date.message}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <Label>Items</Label>
        {fields.map((field, index) => (
          <LineItemRow
            key={field.id}
            index={index}
            control={control}
            register={register}
            setValue={setValue}
            categoryOptions={categoryOptions}
            priceMode={priceModes[index] ?? "unitPrice"}
            onPriceModeChange={(mode) =>
              setPriceModes((prev) => prev.map((m, i) => (i === index ? mode : m)))
            }
            onRemove={() => handleRemove(index)}
            canRemove={fields.length > 1}
            errors={errors.lineItems?.[index] as LineItemErrors}
          />
        ))}

        <AppleButton type="button" variant="secondary" onClick={handleAppend} className="w-fit">
          <Plus {...ICON_PROPS} size={16} />
          Add Item
        </AppleButton>

        {typeof errors.lineItems?.message === "string" && (
          <p className="text-xs text-danger">{errors.lineItems.message}</p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <span className="text-lg font-semibold text-foreground">{formatCurrency(runningTotal)}</span>
      </div>

      {insufficientStock && (
        <p className="text-sm text-danger">
          Not enough stock for one of the linked items — check quantities.
        </p>
      )}
      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <AppleButton type="submit" disabled={isSubmitting} className={cn("mt-2")}>
        {isSubmitting ? "Adding..." : "Add Bill"}
      </AppleButton>
    </form>
  )
}

interface LineItemRowProps {
  index: number
  control: Control<AddBillFormValues>
  register: UseFormRegister<AddBillFormValues>
  setValue: UseFormSetValue<AddBillFormValues>
  categoryOptions: string[]
  priceMode: PriceMode
  onPriceModeChange: (mode: PriceMode) => void
  onRemove: () => void
  canRemove: boolean
  errors?: LineItemErrors
}

/**
 * A single "shopping cart" row: category, an optional inventory link scoped
 * to that row's own category, quantity, and a price section toggling
 * between "Price per item" and "Total for this line".
 */
function LineItemRow({
  index,
  control,
  register,
  setValue,
  categoryOptions,
  priceMode,
  onPriceModeChange,
  onRemove,
  canRemove,
  errors,
}: LineItemRowProps) {
  const quantity = useWatch({ control, name: `lineItems.${index}.quantity` })
  const unitPrice = useWatch({ control, name: `lineItems.${index}.unitPrice` })
  const lineTotal = useWatch({ control, name: `lineItems.${index}.lineTotal` })

  /**
   * Inventory search-as-you-type: searches by name OR brand across the
   * full catalog (not category-scoped — with ~5,000+ bulk-imported SKUs,
   * making staff pick a category first before they can even search added
   * friction rather than removing it). `category` and `inventoryItemId`
   * stay independent fields per the schema (a line item's reporting
   * category doesn't have to match the linked item's own category), so
   * picking a search result auto-fills category as a convenience default
   * but doesn't lock it.
   */
  const [searchTerm, setSearchTerm] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<InventoryItemOption[]>([])
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [selectedItem, setSelectedItem] = React.useState<InventoryItemOption | null>(null)

  React.useEffect(() => {
    const term = searchTerm.trim()
    if (term.length < 2) {
      // Nothing to fetch — the render below already treats a too-short
      // term as "no results" (see `visibleResults`), so there's no need to
      // clear `searchResults` here too (that would be a synchronous
      // setState-in-effect for no behavioral gain).
      return
    }
    let cancelled = false
    const timeout = setTimeout(() => {
      fetch(`/api/inventory?search=${encodeURIComponent(term)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { items?: InventoryItemOption[] } | null) => {
          if (cancelled) return
          setSearchResults(json?.items ?? [])
        })
        .catch(() => {
          // Leave previous results in place.
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [searchTerm])

  const visibleResults = searchTerm.trim().length < 2 ? [] : searchResults

  function selectSearchResult(item: InventoryItemOption) {
    setSelectedItem(item)
    setValue(`lineItems.${index}.inventoryItemId`, item.id)
    setValue(`lineItems.${index}.category`, item.category)
    if (item.ratePerUnit > 0 && priceMode === "unitPrice") {
      setValue(`lineItems.${index}.unitPrice`, item.ratePerUnit)
    }
    setSearchTerm("")
    setSearchOpen(false)
  }

  function clearSelection() {
    setSelectedItem(null)
    setValue(`lineItems.${index}.inventoryItemId`, undefined)
  }

  const rowAmount =
    priceMode === "lineTotal"
      ? Number(lineTotal) || 0
      : (Number(unitPrice) || 0) * (Number(quantity) || 0)

  const priceError =
    (errors?.unitPrice?.message as string | undefined) ??
    (errors?.lineTotal?.message as string | undefined)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`lineItems.${index}.category`}>Category</Label>
            <Controller
              control={control}
              name={`lineItems.${index}.category`}
              render={({ field }) => (
                <Select
                  value={(field.value as string) ?? categoryOptions[0]}
                  onValueChange={(val) => field.onChange(val as string)}
                >
                  <SelectTrigger id={`lineItems.${index}.category`} className="w-full">
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
              )}
            />
            {errors?.category && (
              <p className="text-xs text-danger">{errors.category.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`lineItems.${index}.quantity`}>Quantity</Label>
            <Input
              id={`lineItems.${index}.quantity`}
              type="number"
              inputMode="numeric"
              min={1}
              step="1"
              {...register(`lineItems.${index}.quantity`)}
            />
            {errors?.quantity && (
              <p className="text-xs text-danger">{errors.quantity.message}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remove item"
          className={cn(
            "mt-6 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors",
            canRemove ? "hover:bg-danger/10 hover:text-danger" : "opacity-30"
          )}
        >
          <Trash2 {...ICON_PROPS} size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Link to inventory item (optional)</Label>
        {selectedItem ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <div className="text-sm">
              <span className="font-medium text-foreground">{selectedItem.name}</span>
              {selectedItem.brand && (
                <span className="text-muted-foreground"> · {selectedItem.brand}</span>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedItem.quantity} in stock
                {selectedItem.ratePerUnit > 0 &&
                  ` · ₹${selectedItem.ratePerUnit}/${selectedItem.unitType}`}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear linked item"
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <X {...ICON_PROPS} size={14} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search
              {...ICON_PROPS}
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Search by name or brand…"
              className="pl-9"
            />
            {searchOpen && visibleResults.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-apple-card">
                {visibleResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSearchResult(item)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/50"
                  >
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.brand ? `${item.brand} · ` : ""}
                      {item.category} · {item.quantity} in stock
                      {item.ratePerUnit > 0 && ` · ₹${item.ratePerUnit}/${item.unitType}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {searchOpen && searchTerm.trim().length >= 2 && visibleResults.length === 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-apple-card">
                No matching items.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={`lineItems.${index}.price`}>
            {priceMode === "unitPrice" ? "Price per item (₹)" : "Total for this line (₹)"}
          </Label>
          <PriceModeToggle
            value={priceMode}
            onChange={(mode) => {
              onPriceModeChange(mode)
              if (mode === "unitPrice") {
                setValue(`lineItems.${index}.lineTotal`, undefined)
              } else {
                setValue(`lineItems.${index}.unitPrice`, undefined)
              }
            }}
          />
        </div>
        {priceMode === "unitPrice" ? (
          <Input
            id={`lineItems.${index}.price`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0.00"
            {...register(`lineItems.${index}.unitPrice`)}
          />
        ) : (
          <Input
            id={`lineItems.${index}.price`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0.00"
            {...register(`lineItems.${index}.lineTotal`)}
          />
        )}
        {priceError && <p className="text-xs text-danger">{priceError}</p>}
        <p className="text-xs text-muted-foreground">Line amount: {formatCurrency(rowAmount)}</p>
      </div>
    </div>
  )
}

interface PriceModeToggleProps {
  value: PriceMode
  onChange: (mode: PriceMode) => void
}

/**
 * Small two-option per-row toggle switching which single price input a row
 * shows. Deliberately NOT the shared `SegmentedControl` component — that
 * component's active-indicator uses a single hardcoded `layoutId`, which
 * would visually misbehave with multiple simultaneous instances (one per
 * row) on screen at once. This is a plain, unanimated equivalent using the
 * same visual language (rounded pill, muted track, active segment on
 * `bg-card`).
 */
function PriceModeToggle({ value, onChange }: PriceModeToggleProps) {
  const options: Array<{ mode: PriceMode; label: string }> = [
    { mode: "unitPrice", label: "Per item" },
    { mode: "lineTotal", label: "Line total" },
  ]

  return (
    <div role="tablist" className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {options.map((option) => {
        const isActive = option.mode === value
        return (
          <button
            key={option.mode}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(option.mode)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-card text-foreground shadow-apple-card"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
