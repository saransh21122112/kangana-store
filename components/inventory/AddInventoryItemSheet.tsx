"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import type { z } from "zod"

import { inventoryItemSchema, type InventoryItemInput } from "@/lib/validations/inventory"
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

/** `inventoryItemSchema` transforms `quantity`/`lowStockThreshold` from raw
 * form-input strings into numbers — same z.input vs. output split
 * `AddBillForm`'s `amountSchema` uses, so the form fields stay typed as what
 * the DOM actually produces while `handleSubmit`'s callback gets the
 * transformed output. */
type AddInventoryItemFormValues = z.input<typeof inventoryItemSchema>

export interface AddInventoryItemSheetProps {
  /** Category list, sourced from `AppSettings.categories` and fetched
   * server-side by the page (same data `AddBillForm`'s category `<select>`
   * draws from), passed down as a prop rather than fetched here. */
  categories: string[]
  /** Custom trigger element. Falls back to a default "+ Add Item"
   * AppleButton if omitted — mirrors QuickAddSheet's trigger API. */
  trigger?: React.ReactNode
}

/**
 * "+ Add Item" sheet for `/inventory`, OWNER+STAFF only (the page only
 * renders this for those roles). Mirrors QuickAddSheet's self-contained
 * AppleSheet + react-hook-form + zodResolver shape.
 */
export function AddInventoryItemSheet({ categories, trigger }: AddInventoryItemSheetProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [category, setCategory] = React.useState<string>(categories[0] ?? "")
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddInventoryItemFormValues, unknown, InventoryItemInput>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      name: "",
      category: categories[0] ?? "",
      quantity: 0,
      lowStockThreshold: 5,
    },
  })

  const submit = handleSubmit(async (data) => {
    setServerError(null)
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, category }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        setServerError(json?.error ?? "Could not add item. Please try again.")
        return
      }

      toast.success(`${data.name} added to inventory.`)
      reset()
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
        <AppleButton onClick={() => setOpen(true)}>
          <Plus {...ICON_PROPS} size={18} />
          Add Item
        </AppleButton>
      )}

      <AppleSheet
        open={open}
        onOpenChange={setOpen}
        title="Add Inventory Item"
        description="Track a new item's stock. You can adjust quantity anytime from the list."
      >
        <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-name">Name</Label>
            <Input id="inv-name" placeholder="e.g. Gold Bangle Set" {...register("name")} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-category">Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as string)}>
              <SelectTrigger className="w-full" id="inv-category">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-quantity">Starting Quantity</Label>
              <Input
                id="inv-quantity"
                type="number"
                min={0}
                inputMode="numeric"
                {...register("quantity")}
              />
              {errors.quantity && <p className="text-xs text-danger">{errors.quantity.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-threshold">Low Stock Threshold</Label>
              <Input
                id="inv-threshold"
                type="number"
                min={0}
                inputMode="numeric"
                {...register("lowStockThreshold")}
              />
              {errors.lowStockThreshold && (
                <p className="text-xs text-danger">{errors.lowStockThreshold.message}</p>
              )}
            </div>
          </div>

          {serverError && <p className="text-sm text-danger">{serverError}</p>}

          <AppleButton type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Adding..." : "Add Item"}
          </AppleButton>
        </form>
      </AppleSheet>
    </>
  )
}
