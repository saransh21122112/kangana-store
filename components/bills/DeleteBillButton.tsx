"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ICON_PROPS } from "@/lib/icon-map"
import { cn } from "@/lib/utils"

export interface DeleteBillButtonProps {
  billId: string
}

/**
 * Small inline icon-only trash button for a single bill row, OWNER-only
 * (both `bills/page.tsx` and `BillHistoryTable` only render this when
 * `isOwner` is true). Mirrors `UserManagementTable`'s `deleteUser`
 * fetch/toast/loading-state pattern: `window.confirm` guard, disabled
 * while the request is pending, `sonner` toast on success/failure, and
 * `router.refresh()` to re-fetch the server-rendered list afterward.
 */
export function DeleteBillButton({ billId }: DeleteBillButtonProps) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleDelete() {
    if (!window.confirm("Delete this bill? This can't be undone.")) return

    setPending(true)
    try {
      const res = await fetch(`/api/bills/${billId}`, { method: "DELETE" })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        toast.error(json?.error ?? "Could not delete bill. Please try again.")
        return
      }

      toast.success("Bill deleted.")
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
      aria-label="Delete bill"
      title="Delete bill"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:opacity-50"
      )}
    >
      <Trash2 {...ICON_PROPS} size={16} />
    </button>
  )
}
