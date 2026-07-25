"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Undo2 } from "lucide-react"
import { toast } from "sonner"

import { AppleButton } from "@/components/apple/AppleButton"
import { AppleSheet } from "@/components/apple/AppleSheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ICON_PROPS } from "@/lib/icon-map"
import { cn } from "@/lib/utils"
import type { BillLineItem, BillReturn } from "@/lib/generated/prisma/client"

type LineItemWithReturns = BillLineItem & { returns: BillReturn[] }

export interface RecordReturnSheetProps {
  billId: string
  billNo: string
  lineItems: LineItemWithReturns[]
  onSuccess?: () => void
}

function availableQuantity(lineItem: LineItemWithReturns): number {
  const alreadyReturned = lineItem.returns.reduce((sum, r) => sum + r.quantityReturned, 0)
  return lineItem.quantity - alreadyReturned
}

/**
 * Per-bill "Return" entry point (OWNER+STAFF, same mutation permission as
 * bill creation). Lets staff pick one of the bill's line items — only
 * those with remaining returnable quantity are selectable — enter how many
 * units are being returned, and an optional reason. `amountReturned` is
 * never entered here; the server always computes it pro-rata from the
 * line's own `lineTotal`/`quantity` (see `createReturn`). Always calls
 * `router.refresh()` on success (same self-sufficient pattern as
 * `DeleteBillButton`) so the server-rendered list/stats re-fetch without
 * requiring every caller to wire that up itself; `onSuccess` is an
 * additional optional hook for callers that need more (e.g. closing a
 * parent sheet).
 */
export function RecordReturnSheet({ billId, billNo, lineItems, onSuccess }: RecordReturnSheetProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const returnableItems = React.useMemo(
    () => lineItems.filter((li) => availableQuantity(li) > 0),
    [lineItems]
  )

  const [lineItemId, setLineItemId] = React.useState<string>("")
  const [quantity, setQuantity] = React.useState<string>("1")
  const [reason, setReason] = React.useState<string>("")

  // Resetting the form fields when the sheet transitions from closed to
  // open is state derived from a prop changing between renders, not a
  // synchronization with an external system — so per React's "Adjusting
  // some state when a prop changes" pattern (same approach `AddBillForm`'s
  // `LineItemRow` uses for its category-change reset), this compares
  // against a state snapshot of the last-seen `open` value and calls
  // `setState` directly in the render body when it differs, rather than in
  // a `useEffect`.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setLineItemId(returnableItems[0]?.id ?? "")
      setQuantity("1")
      setReason("")
      setError(null)
    }
  }

  const selectedLineItem = returnableItems.find((li) => li.id === lineItemId)
  const maxQuantity = selectedLineItem ? availableQuantity(selectedLineItem) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const qty = Number(quantity)
    if (!selectedLineItem) {
      setError("Select an item to return.")
      return
    }
    if (!Number.isInteger(qty) || qty <= 0 || qty > maxQuantity) {
      setError(`Enter a quantity between 1 and ${maxQuantity}.`)
      return
    }

    setPending(true)
    try {
      const res = await fetch(`/api/bills/${billId}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItemId: selectedLineItem.id,
          quantityReturned: qty,
          reason: reason.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        setError(json?.error ?? "Could not record return. Please try again.")
        return
      }

      toast.success("Return recorded.")
      setOpen(false)
      router.refresh()
      onSuccess?.()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Record return"
        title="Record return"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
        )}
      >
        <Undo2 {...ICON_PROPS} size={16} />
      </button>

      <AppleSheet
        open={open}
        onOpenChange={setOpen}
        title="Record Return"
        description={`Bill ${billNo} — partial or full returns reduce this customer's spend and restore stock.`}
      >
        {returnableItems.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Every item on this bill has already been fully returned.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-line-item">Item</Label>
              <Select value={lineItemId} onValueChange={(val) => setLineItemId(val ?? "")}>
                <SelectTrigger id="return-line-item" className="w-full">
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {returnableItems.map((li) => (
                    <SelectItem key={li.id} value={li.id}>
                      {li.category} ({availableQuantity(li)} of {li.quantity} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-quantity">Quantity to return</Label>
              <Input
                id="return-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQuantity}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Up to {maxQuantity} available.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-reason">Reason (optional)</Label>
              <Textarea
                id="return-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Size exchange, customer dissatisfaction..."
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <AppleButton type="submit" disabled={pending} className="mt-2">
              {pending ? "Recording..." : "Record Return"}
            </AppleButton>
          </form>
        )}
      </AppleSheet>
    </>
  )
}
