import { AppleCard } from "@/components/apple/AppleCard"
import type { TopSellingItem } from "@/lib/queries/dashboard-stats"

export interface TopSellingProductsTableProps {
  items: TopSellingItem[]
  periodLabel: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount
  )
}

/**
 * Product-level sales breakdown for the Reports page's period filter — the
 * catalog analogue of the Top Spenders table below it, fed by
 * `getTopSellingItemsInRange` (only line items linked to a real
 * `InventoryItem` are counted; ad-hoc line items have no product identity
 * to rank by).
 */
export function TopSellingProductsTable({ items, periodLabel }: TopSellingProductsTableProps) {
  return (
    <AppleCard glow className="overflow-x-auto p-0">
      <h2 className="px-4 pt-4 text-sm font-medium text-foreground">Top Selling Products ({periodLabel})</h2>
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Brand</th>
            <th className="px-4 py-3 text-right">Quantity Sold</th>
            <th className="px-4 py-3 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                No product sales in this period yet.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted-foreground">#{index + 1}</td>
                <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.brand ?? "—"}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{item.totalQuantity}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCurrency(item.totalRevenue)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </AppleCard>
  )
}
