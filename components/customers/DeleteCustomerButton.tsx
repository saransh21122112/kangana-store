"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { AppleButton } from "@/components/apple/AppleButton"
import { AppleSheet } from "@/components/apple/AppleSheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ICON_PROPS } from "@/lib/icon-map"

export interface DeleteCustomerButtonProps {
  customerId: string
  customerName: string
}

/**
 * OWNER-only "delete customer" entry point for the profile header. More
 * destructive than `DeleteBillButton` (cascades to every Bill + MessageLog
 * row belonging to this customer — see `deleteCustomer` in
 * lib/queries/customers.ts), so instead of a plain `window.confirm` this
 * opens an `AppleSheet` (same trigger+sheet structure as `QuickAddSheet`)
 * requiring the user to type the customer's exact name before the delete
 * button enables. Fetch/toast/loading-state mirrors
 * `UserManagementTable`'s `deleteUser`.
 */
export function DeleteCustomerButton({ customerId, customerName }: DeleteCustomerButtonProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [confirmText, setConfirmText] = React.useState("")
  const [pending, setPending] = React.useState(false)

  const canDelete = confirmText.trim() === customerName

  async function handleDelete() {
    if (!canDelete) return

    setPending(true)
    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: "DELETE" })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        toast.error(json?.error ?? "Could not delete customer. Please try again.")
        return
      }

      toast.success(`${customerName} was deleted.`)
      router.push("/customers")
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <AppleButton
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => {
          setConfirmText("")
          setOpen(true)
        }}
      >
        <Trash2 {...ICON_PROPS} size={16} />
        Delete Customer
      </AppleButton>

      <AppleSheet
        open={open}
        onOpenChange={setOpen}
        title="Delete Customer"
        description="This permanently deletes this customer, along with all of their bills and message history. This can't be undone."
      >
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-confirm-name">
              Type <span className="font-semibold text-foreground">{customerName}</span> to confirm
            </Label>
            <Input
              id="delete-confirm-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={customerName}
              autoComplete="off"
            />
          </div>

          <AppleButton
            type="button"
            variant="destructive"
            disabled={!canDelete || pending}
            onClick={handleDelete}
          >
            {pending ? "Deleting..." : "Delete Customer"}
          </AppleButton>
        </div>
      </AppleSheet>
    </>
  )
}
