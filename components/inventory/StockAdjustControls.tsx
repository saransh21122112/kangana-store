"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Minus } from "lucide-react"
import { toast } from "sonner"

import { ICON_PROPS } from "@/lib/icon-map"
import { cn } from "@/lib/utils"

export interface StockAdjustControlsProps {
  itemId: string
}

/**
 * Small inline +1/-1 stock adjust controls for a single inventory row,
 * OWNER+STAFF only (the page only renders this for those roles). Calls the
 * dedicated delta-based `POST /api/inventory/[id]/adjust` endpoint (not the
 * item-details `PATCH`), then `router.refresh()` — same fetch/pending/
 * `router.refresh()` shape as `DeleteBillButton`, minus the confirm dialog
 * (a single-unit stock nudge doesn't warrant one).
 */
export function StockAdjustControls({ itemId }: StockAdjustControlsProps) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function adjust(delta: number) {
    setPending(true)
    try {
      const res = await fetch(`/api/inventory/${itemId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        toast.error(json?.error ?? "Could not update stock. Please try again.")
        return
      }

      router.refresh()
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => adjust(-1)}
        disabled={pending}
        aria-label="Remove one from stock"
        title="Remove one"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <Minus {...ICON_PROPS} size={14} />
      </button>
      <button
        type="button"
        onClick={() => adjust(1)}
        disabled={pending}
        aria-label="Add one to stock"
        title="Add one"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <Plus {...ICON_PROPS} size={14} />
      </button>
    </div>
  )
}
