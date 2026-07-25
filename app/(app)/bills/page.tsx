import Link from "next/link"
import { Download, Receipt } from "lucide-react"

import { auth } from "@/lib/auth"
import { getAllBills } from "@/lib/queries/bills"
import { AppleCard } from "@/components/apple/AppleCard"
import { AppleButton } from "@/components/apple/AppleButton"
import { EmptyState } from "@/components/apple/EmptyState"
import { BillFilterBar } from "@/components/bills/BillFilterBar"
import { AddBillGlobalSheet } from "@/components/bills/AddBillGlobalSheet"
import { DeleteBillButton } from "@/components/bills/DeleteBillButton"
import { DownloadBillButton } from "@/components/bills/DownloadBillButton"
import { RecordReturnSheet } from "@/components/bills/RecordReturnSheet"
import { ICON_PROPS } from "@/lib/icon-map"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount
  )
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

/**
 * Compact summary of a bill's line items for the global bills table's
 * "Category" column — same "first distinct category + N more" convention
 * as `BillHistoryTable`'s per-customer list, for a consistent feel across
 * both bill listings.
 */
function summarizeLineItems(lineItems: Array<{ category: string }>): string {
  if (lineItems.length === 0) return "No items"
  const distinctCategories = Array.from(new Set(lineItems.map((li) => li.category)))
  const [first, ...rest] = distinctCategories
  return rest.length > 0 ? `${first} +${rest.length} more` : first
}

interface BillsPageProps {
  // Same server-component-reads-searchParams / client-filter-bar-pushes-URL
  // split established by `/customers` (CustomerFilterBar) and `/lists`
  // (ListsSegmentedNav).
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

// See app/(app)/(dashboard)/page.tsx for why this is needed: without it,
// Next statically prerenders this page at build time and new/edited bills
// never show up here on reload in production.
export const dynamic = "force-dynamic"

export default async function BillsPage({ searchParams }: BillsPageProps) {
  const session = await auth()
  const isViewer = session?.user.role === "VIEWER"
  const isOwner = session?.user.role === "OWNER"

  const params = await searchParams

  const category = firstValue(params.category)
  const minAmountRaw = firstValue(params.minAmount)
  const maxAmountRaw = firstValue(params.maxAmount)
  const dateFromRaw = firstValue(params.dateFrom)
  const dateToRaw = firstValue(params.dateTo)

  const bills = await getAllBills({
    category,
    minAmount: minAmountRaw ? Number(minAmountRaw) : undefined,
    maxAmount: maxAmountRaw ? Number(maxAmountRaw) : undefined,
    dateFrom: dateFromRaw ? new Date(dateFromRaw) : undefined,
    // Inclusive of the whole "to" day, matching `/customers`'s lastVisitTo convention.
    dateTo: dateToRaw ? new Date(`${dateToRaw}T23:59:59.999Z`) : undefined,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Visits &amp; Bills</h1>
          <div className="gradient-hairline mt-2 h-0.5 w-14 rounded-full" />
          <p className="mt-2 text-sm text-muted-foreground">
            {bills.length} bill{bills.length === 1 ? "" : "s"} matching.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BillFilterBar />
          {!isViewer && (
            <>
              <a href="/api/export/bills">
                <AppleButton variant="secondary">
                  <Download {...ICON_PROPS} size={18} />
                  Export CSV
                </AppleButton>
              </a>
              <AddBillGlobalSheet />
            </>
          )}
        </div>
      </div>

      {bills.length === 0 ? (
        <AppleCard>
          <EmptyState
            icon={Receipt}
            title="No bills yet"
            description="Add a bill from a customer's profile or the global Add Bill flow to start tracking visits."
          />
        </AppleCard>
      ) : (
        <AppleCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Bill No.</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3 text-foreground">{formatDate(bill.date)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{bill.billNo}</td>
                  <td className="px-4 py-3">
                    <Link href={`/customers/${bill.customer.id}`} className="font-medium text-foreground hover:underline">
                      {bill.customer.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{bill.customer.mobileNumber}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{summarizeLineItems(bill.lineItems)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {formatCurrency(bill.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DownloadBillButton billId={bill.id} />
                      {!isViewer && (
                        <RecordReturnSheet billId={bill.id} billNo={bill.billNo} lineItems={bill.lineItems} />
                      )}
                      {isOwner && <DeleteBillButton billId={bill.id} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AppleCard>
      )}
    </div>
  )
}
