"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import type { z } from "zod"

import {
  inventoryItemUpdateSchema,
  UNIT_TYPE_OPTIONS,
  type InventoryItemUpdateInput,
} from "@/lib/validations/inventory"
import { AppleSheet } from "@/components/apple/AppleSheet"
import { AppleButton } from "@/components/apple/AppleButton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ICON_PROPS } from "@/lib/icon-map"
import { cn } from "@/lib/utils"
import type { InventoryItem } from "@/lib/generated/prisma/client"

type EditInventoryItemFormValues = z.input<typeof inventoryItemUpdateSchema>

export interface EditInventoryItemSheetProps {
  item: InventoryItem
  /** Category list, sourced from `AppSettings.categories` and fetched
   * server-side by the page — same prop `AddInventoryItemSheet` takes. */
  categories: string[]
  /** Custom trigger element. Falls back to a default icon-only edit button
   * if omitted — mirrors QuickAddSheet/AddInventoryItemSheet's trigger API. */
  trigger?: React.ReactNode
}

/**
 * Edit sheet for a single inventory item's name/category/lowStockThreshold —
 * PATCHes instead of POSTs, otherwise the same AppleSheet + react-hook-form +
 * zodResolver shape as `AddInventoryItemSheet`. Quantity is intentionally
 * not editable here — stock changes go through `StockAdjustControls`
 * (`POST /api/inventory/[id]/adjust`) instead.
 */
export function EditInventoryItemSheet({ item, categories, trigger }: EditInventoryItemSheetProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [category, setCategory] = React.useState<string>(item.category)
  const [unitType, setUnitType] = React.useState<string>(item.unitType)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditInventoryItemFormValues, unknown, InventoryItemUpdateInput>({
    resolver: zodResolver(inventoryItemUpdateSchema),
    defaultValues: {
      name: item.name,
      category: item.category,
      brand: item.brand ?? "",
      ratePerUnit: item.ratePerUnit,
      lowStockThreshold: item.lowStockThreshold,
    },
  })

  const submit = handleSubmit(async (data) => {
    setServerError(null)
    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, category, unitType }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        setServerError(json?.error ?? "Could not update item. Please try again.")
        return
      }

      toast.success(`${data.name ?? item.name} updated.`)
      setOpen(false)
      router.refresh()
    } catch {
      setServerError("Network error. Please try again.")
    }
  })

  return (
    <>
      {trigger ? (
        React.isValidElement(trigger) ? (
          React.cloneElement(
            trigger as React.ReactElement<{ onClick?: () => void }>,
            { onClick: () => setOpen(true) }
          )
        ) : (
          trigger
        )
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Edit item"
          title="Edit item"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          )}
        >
          <Pencil {...ICON_PROPS} size={16} />
        </button>
      )}

      <AppleSheet
        open={open}
        onOpenChange={setOpen}
        title="Edit Inventory Item"
        description="Update this item's name, category, or low-stock threshold."
      >
        <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-inv-name">Name</Label>
            <Input id="edit-inv-name" placeholder="e.g. Gold Bangle Set" {...register("name")} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-inv-category">Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as string)}>
              <SelectTrigger className="w-full" id="edit-inv-category">
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
            {errors.category && <p className="text-xs text-danger">{errors.category.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-inv-brand">Brand (optional)</Label>
            <Input id="edit-inv-brand" placeholder="e.g. LAKME" {...register("brand")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-inv-unit-type">Unit</Label>
              <Select value={unitType} onValueChange={(value) => setUnitType(value as string)}>
                <SelectTrigger className="w-full" id="edit-inv-unit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPE_OPTIONS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-inv-rate">Rate per {unitType}</Label>
              <Input
                id="edit-inv-rate"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                {...register("ratePerUnit")}
              />
              {errors.ratePerUnit && (
                <p className="text-xs text-danger">{errors.ratePerUnit.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-inv-threshold">Low Stock Threshold</Label>
            <Input
              id="edit-inv-threshold"
              type="number"
              min={0}
              inputMode="numeric"
              {...register("lowStockThreshold")}
            />
            {errors.lowStockThreshold && (
              <p className="text-xs text-danger">{errors.lowStockThreshold.message}</p>
            )}
          </div>

          {serverError && <p className="text-sm text-danger">{serverError}</p>}

          <AppleButton type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </AppleButton>
        </form>
      </AppleSheet>
    </>
  )
}
