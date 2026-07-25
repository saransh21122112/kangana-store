"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Receipt, Plus } from "lucide-react"
import { toast } from "sonner"

import { AppleCard } from "@/components/apple/AppleCard"
import { AppleButton } from "@/components/apple/AppleButton"
import { AppleSheet } from "@/components/apple/AppleSheet"
import { EmptyState } from "@/components/apple/EmptyState"
import { AddBillForm } from "@/components/bills/AddBillForm"
import { DeleteBillButton } from "@/components/bills/DeleteBillButton"
import { DownloadBillButton } from "@/components/bills/DownloadBillButton"
import { RecordReturnSheet } from "@/components/bills/RecordReturnSheet"
import { getCategoryIcon, ICON_PROPS } from "@/lib/icon-map"
import type { Bill, BillLineItem, BillReturn } from "@/lib/generated/prisma/client"

type LineItemWithReturns = BillLineItem & { returns: BillReturn[] }

export interface BillHistoryTableProps {
  customerId: string
  bills: Array<Bill & { lineItems: LineItemWithReturns[] }>
  /** VIEWER never sees the "+ Add Bill" trigger or the "Return" action (read-only). */
  isViewer?: boolean
  /** Only OWNER sees the per-row delete action. */
  isOwner?: boolean
  /** STAFF can add bills but can't see amounts, download PDFs (they contain
   * amounts), or process returns. */
  isStaff?: boolean
}

/**
 * Compact summary of a bill's line items for a per-customer history row —
 * e.g. "Skincare" (single item), "Skincare +2 more" (multiple distinct
 * categories), or "3 items" as a fallback when there are no line items to
 * read a category from (shouldn't happen post-rollout, but keeps this
 * defensive). Judgment call: first-category + "+N more" reads more
 * informatively than a bare item count in a per-customer list like this.
 */
function summarizeLineItems(lineItems: LineItemWithReturns[]): string {
  if (lineItems.length === 0) return "No items"
  const distinctCategories = Array.from(new Set(lineItems.map((li) => li.category)))
  const [first, ...rest] = distinctCategories
  return rest.length > 0 ? `${first} +${rest.length} more` : first
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount
  )
}

/**
 * Reusable bill-history list for a single customer (extracted from
 * CustomerProfileTabs, which originally had this inline read-only) plus a
 * "+ Add Bill" entry point scoped to that customer. Sorted reverse-
 * chronological — mirrors the `getCustomerById` query's own `orderBy: {
 * date: "desc" }`, but re-sorts defensively here too since callers could
 * pass unsorted data.
 */
export function BillHistoryTable({ customerId, bills, isViewer, isOwner, isStaff }: BillHistoryTableProps) {
  const showSensitive = !isStaff
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  const sortedBills = React.useMemo(
    () => [...bills].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [bills]
  )

  return (
    <div className="flex flex-col gap-3">
      {!isViewer && (
        <div className="flex items-center justify-end">
          <AppleButton onClick={() => setOpen(true)} variant="secondary">
            <Plus {...ICON_PROPS} size={16} />
            Add Bill
          </AppleButton>
        </div>
      )}

      <AppleCard glow noPadding className="overflow-hidden">
        {sortedBills.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No bills yet"
            description="This customer's purchase history will show up here once a bill is recorded."
          />
        ) : (
          <ul className="divide-y divide-border">
            {sortedBills.map((bill) => {
              const Icon = getCategoryIcon(bill.lineItems[0]?.category)
              return (
                <li key={bill.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Icon {...ICON_PROPS} size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{bill.billNo}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(bill.date)} &middot; {summarizeLineItems(bill.lineItems)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {showSensitive && (
                      <span className="text-sm font-semibold text-foreground">
                        {formatCurrency(bill.amount)}
                      </span>
                    )}
                    {showSensitive && <DownloadBillButton billId={bill.id} />}
                    {isOwner && (
                      <RecordReturnSheet billId={bill.id} billNo={bill.billNo} lineItems={bill.lineItems} />
                    )}
                    {isOwner && <DeleteBillButton billId={bill.id} />}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </AppleCard>

      <AppleSheet
        open={open}
        onOpenChange={setOpen}
        title="Add Bill"
        description="Record a new purchase for this customer."
      >
        <AddBillForm
          customerId={customerId}
          onSuccess={() => {
            setOpen(false)
            toast.success("Bill added.")
            // The profile page's rollup stat tiles and this bill list are
            // both server-rendered — router.refresh() re-fetches them so
            // the new bill and updated stats show up without a full
            // reload (same pattern Stage 3 needed for QuickAddSheet).
            router.refresh()
          }}
        />
      </AppleSheet>
    </div>
  )
}
