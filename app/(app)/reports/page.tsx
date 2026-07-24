import { Download } from "lucide-react"

import { getDailySalesLast30Days, getSalesByCategory, getTotalSales } from "@/lib/queries/dashboard-stats"
import { getTopSpenders } from "@/lib/queries/customer-lists"
import { AppleCard } from "@/components/apple/AppleCard"
import { AppleButton } from "@/components/apple/AppleButton"
import { StatTile } from "@/components/apple/StatTile"
import { RevenueChart } from "@/components/dashboard/RevenueChart"
import { CategoryBreakdownChart } from "@/components/dashboard/CategoryBreakdownChart"
import { ICON_PROPS } from "@/lib/icon-map"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount
  )
}

/**
 * A "Reports" sidebar item has existed since Stage 1's design-system brief,
 * but no build phase ever specified what it should contain — Dashboard
 * (Stage 7) ended up covering most of the same ground. Rather than leave
 * the nav link 404ing, this reuses Stage 7's existing query functions/chart
 * components to give it real (if intentionally light) content: this
 * month's revenue trend, the category breakdown, and a top-spenders table,
 * plus CSV export links already built in Stage 9.
 */
// See app/(app)/(dashboard)/page.tsx for why this is needed: without it,
// Next statically prerenders this page at build time and it never reflects
// bills added after that build (this is what caused "Total Sales This
// Month" to show a stale, too-low figure in production).
export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const [dailySales, categorySales, salesThisMonth, topSpenders] = await Promise.all([
    getDailySalesLast30Days(),
    getSalesByCategory(),
    getTotalSales("month"),
    getTopSpenders(10),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Reports</h1>
          <div className="gradient-hairline mt-2 h-0.5 w-14 rounded-full" />
          <p className="mt-2 text-sm text-muted-foreground">
            Sales trends, category breakdown, and top customers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/export/customers">
            <AppleButton variant="secondary">
              <Download {...ICON_PROPS} size={18} />
              Customers CSV
            </AppleButton>
          </a>
          <a href="/api/export/bills">
            <AppleButton variant="secondary">
              <Download {...ICON_PROPS} size={18} />
              Bills CSV
            </AppleButton>
          </a>
        </div>
      </div>

      <StatTile label="Total Sales This Month" value={formatCurrency(salesThisMonth)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AppleCard>
          <h2 className="mb-4 text-sm font-medium text-foreground">Daily Sales (Last 30 Days)</h2>
          <RevenueChart data={dailySales} />
        </AppleCard>
        <AppleCard>
          <h2 className="mb-4 text-sm font-medium text-foreground">Sales by Category</h2>
          <CategoryBreakdownChart data={categorySales} />
        </AppleCard>
      </div>

      <AppleCard className="overflow-x-auto p-0">
        <h2 className="px-4 pt-4 text-sm font-medium text-foreground">Top Spenders</h2>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3 text-right">Total Spend</th>
            </tr>
          </thead>
          <tbody>
            {topSpenders.map((customer, index) => (
              <tr key={customer.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted-foreground">#{index + 1}</td>
                <td className="px-4 py-3 font-medium text-foreground">{customer.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{customer.mobileNumber}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCurrency(customer.totalPurchaseAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AppleCard>
    </div>
  )
}
