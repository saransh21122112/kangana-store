"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AppleButton } from "@/components/apple/AppleButton"
import { Input } from "@/components/ui/input"

export interface LoyaltyPointsAdjusterProps {
  customerId: string
}

/**
 * Manual loyalty-point adjustment, OWNER+STAFF only (the caller only
 * renders this for those roles). Unlike inventory's +1/-1
 * `StockAdjustControls`, redemption/correction amounts are usually bigger
 * than one point at a time, so this is a free-entry delta (positive to
 * add, negative to subtract) rather than fixed nudge buttons. Same fetch/
 * toast/`router.refresh()` shape as `StockAdjustControls`.
 */
export function LoyaltyPointsAdjuster({ customerId }: LoyaltyPointsAdjusterProps) {
  const router = useRouter()
  const [delta, setDelta] = React.useState("")
  const [pending, setPending] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(delta)
    if (!Number.isInteger(parsed) || parsed === 0) {
      toast.error("Enter a non-zero whole number.")
      return
    }

    setPending(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/loyalty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: parsed }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        toast.error(json?.error ?? "Could not update loyalty points. Please try again.")
        return
      }

      toast.success(parsed > 0 ? `Added ${parsed} points.` : `Subtracted ${Math.abs(parsed)} points.`)
      setDelta("")
      router.refresh()
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <Input
        type="number"
        step="1"
        placeholder="±points"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        disabled={pending}
        className="h-8 w-20 text-xs"
        aria-label="Loyalty points adjustment"
      />
      <AppleButton type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "..." : "Apply"}
      </AppleButton>
    </form>
  )
}
