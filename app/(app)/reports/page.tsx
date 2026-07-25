import { Download } from "lucide-react"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import {
  getDailySalesForDays,
  getSalesByCategoryInRange,
  getTopSellingItemsInRange,
  getDaysWindow,
} from "@/lib/queries/dashboard-stats"
import { getTopSpendersInRange } from "@/lib/queries/customer-lists"
import { AppleCard } from "@/components/apple/AppleCard"
import { AppleButton } from "@/components/apple/AppleButton"
import { AuroraBackground } from "@/components/apple/AuroraBackground"
import { StatTile } from "@/components/apple/StatTile"
import { RevenueChart } from "@/components/dashboard/RevenueChart"
import { CategoryBreakdownChart } from "@/components/dashboard/CategoryBreakdownChart"
import { ReportsPeriodFilter } from "@/components/reports/ReportsPeriodFilter"
import { TopSellingProductsTable } from "@/components/reports/TopSellingProductsTable"
import { REPORTS_PERIOD_OPTIONS, isReportsPeriodValue, type ReportsPeriodValue } from "@/lib/reports-period"
import { ICON_PROPS } from "@/lib/icon-map"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount
  )
}

interface ReportsPageProps {
  searchParams: Promise<{ period?: string }>
}

/**
 * A "Reports" sidebar item has existed since Stage 1's design-system brief,
 * but no build phase ever specified what it should contain — Dashboard
 * (Stage 7) ended up covering most of the same ground. Rather than leave
 * the nav link 404ing, this reuses Stage 7's existing query functions/chart
 * components to give it real (if intentionally light) content: a revenue
 * trend, the category breakdown, and a top-spenders table, plus CSV export
 * links already built in Stage 9.
 *
 * The whole page is now driven by a single `?period=` filter (30/60/90/365
 * days) — a real bug, reported directly: the category donut and top
 * spenders table used to be all-time totals with no date bound at all,
 * silently mismatched against the "last 30 days" framing everything else
 * on the page implied. `getDaysWindow` computes one `[start, end)` window
 * from the selected period and every section below is fetched against
 * that exact same window, so nothing on the page can drift out of sync
 * with what the filter says it's showing.
 */
// See app/(app)/(dashboard)/page.tsx for why this is needed: without it,
// Next statically prerenders this page at build time and it never reflects
// bills added after that build (this is what caused "Total Sales This
// Month" to show a stale, too-low figure in production).
export const dynamic = "force-dynamic"

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth()
  const isViewer = session?.user.role === "VIEWER"

  // STAFF is a data-entry-only role — no access to store-wide reports.
  // See app/(app)/(dashboard)/page.tsx for the matching redirect.
  if (session?.user.role === "STAFF") {
    redirect("/customers")
  }

  const params = await searchParams
  const period: ReportsPeriodValue = isReportsPeriodValue(params.period) ? params.period : "30"
  const days = Number(period)
  const { start, end } = getDaysWindow(days)
  const periodLabel = REPORTS_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "30 Days"

  const [dailySales, categorySales, topSpenders, topSellingItems] = await Promise.all([
    getDailySalesForDays(days),
    getSalesByCategoryInRange(start, end),
    getTopSpendersInRange(start, end, 10),
    getTopSellingItemsInRange(start, end, 10),
  ])
  // Derived from the same `dailySales` window rather than a separate
  // `getTotalSales` call, so the headline figure is guaranteed to equal
  // the sum of what the chart directly below it is showing.
  const totalSalesInPeriod = dailySales.reduce((sum, d) => sum + d.total, 0)

  return (
    <div className="relative flex flex-col gap-6">
      <AuroraBackground />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Reports</h1>
          <div className="gradient-hairline mt-2 h-0.5 w-14 rounded-full" />
          <p className="mt-2 text-sm text-muted-foreground">
            Sales trends, category breakdown, and top customers.
          </p>
        </div>
        {!isViewer && (
          <div className="flex flex-wrap items-center gap-2">
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
        )}
      </div>

      <ReportsPeriodFilter value={period} />

      <StatTile label={`Total Sales — ${periodLabel}`} value={formatCurrency(totalSalesInPeriod)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AppleCard glow>
          <h2 className="mb-4 text-sm font-medium text-foreground">Daily Sales ({periodLabel})</h2>
          <RevenueChart data={dailySales} />
        </AppleCard>
        <AppleCard glow>
          <h2 className="mb-4 text-sm font-medium text-foreground">Sales by Category ({periodLabel})</h2>
          <CategoryBreakdownChart data={categorySales} />
        </AppleCard>
      </div>

      <AppleCard glow className="overflow-x-auto p-0">
        <h2 className="px-4 pt-4 text-sm font-medium text-foreground">Top Spenders ({periodLabel})</h2>
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
            {topSpenders.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No sales in this period yet.
                </td>
              </tr>
            ) : (
              topSpenders.map((customer, index) => (
                <tr key={customer.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">#{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{customer.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.mobileNumber}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {formatCurrency(customer.totalSpend)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AppleCard>

      <TopSellingProductsTable items={topSellingItems} periodLabel={periodLabel} />
    </div>
  )
}
