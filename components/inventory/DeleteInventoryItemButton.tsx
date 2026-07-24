"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ICON_PROPS } from "@/lib/icon-map"
import { cn } from "@/lib/utils"

export interface DeleteInventoryItemButtonProps {
  itemId: string
}

/**
 * Small inline icon-only trash button for a single inventory item row,
 * OWNER-only (mirrors `DeleteBillButton` exactly): `window.confirm` guard,
 * disabled while the request is pending, `sonner` toast on success/failure,
 * and `router.refresh()` to re-fetch the server-rendered list afterward.
 */
export function DeleteInventoryItemButton({ itemId }: DeleteInventoryItemButtonProps) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleDelete() {
    if (!window.confirm("Delete this inventory item? This can't be undone.")) return

    setPending(true)
    try {
      const res = await fetch(`/api/inventory/${itemId}`, { method: "DELETE" })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        toast.error(json?.error ?? "Could not delete item. Please try again.")
        return
      }

      toast.success("Item deleted.")
      router.refresh()
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      aria-label="Delete item"
      title="Delete item"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:opacity-50"
      )}
    >
      <Trash2 {...ICON_PROPS} size={16} />
    </button>
  )
}
