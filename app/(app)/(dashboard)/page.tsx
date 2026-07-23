import { Cake, Heart } from "lucide-react"

import {
  getBirthdaysThisWeek,
  getAnniversariesThisWeek,
  getInactiveCustomers,
} from "@/lib/queries/customer-lists"
import { getDashboardStats } from "@/lib/queries/dashboard-stats"
import { getSettings } from "@/lib/queries/settings"
import { AppleCard } from "@/components/apple/AppleCard"
import { PageTransition } from "@/components/apple/motion"
import { StatTilesRow } from "@/components/dashboard/StatTilesRow"
import { MiniListCard } from "@/components/dashboard/MiniListCard"
import { NeedsAttentionCard } from "@/components/dashboard/NeedsAttentionCard"
import { RevenueChart } from "@/components/dashboard/RevenueChart"
import { CategoryBreakdownChart } from "@/components/dashboard/CategoryBreakdownChart"

/**
 * Force dynamic (per-request) rendering. Without this, Next statically
 * prerenders this route at build time (confirmed via `npm run build`'s
 * route summary showing `○ /` — static — before this fix) because nothing
 * in this route or its layout calls a dynamic API (cookies/headers/
 * searchParams). That's wrong for a dashboard whose entire point is "today's
 * activity": a statically-generated build would freeze Today's
 * Sales/Customers/Birthdays etc. at whatever they were at build time and
 * never update again until the next deploy. It also meant `next build`
 * needed a live DB connection just to prerender this one page — which broke
 * Docker builds run without real database credentials. Every other
 * data-driven route in this app (`/customers`, `/lists`, `/settings`, ...)
 * already renders dynamically for the same reason; the dashboard should too.
 */
export const dynamic = "force-dynamic"

/**
 * Real dashboard (Stage 7), replacing the Stage 1/10 static placeholder.
 * Server component: every number/list is fetched here and handed down as
 * props — only the charts and the Today/This-Month sales toggle need to
 * run in the browser.
 */
export default async function DashboardPage() {
  const [stats, birthdays, anniversaries, inactive30, inactive60, inactive90, settings] = await Promise.all([
    getDashboardStats(),
    getBirthdaysThisWeek(),
    getAnniversariesThisWeek(),
    getInactiveCustomers(30),
    getInactiveCustomers(60),
    getInactiveCustomers(90),
    getSettings(),
  ])

  const birthdaysToday = birthdays.filter((b) => b.daysUntil === 0).length
  const anniversariesToday = anniversaries.filter((a) => a.daysUntil === 0).length

  return (
    <PageTransition className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <div className="gradient-hairline mt-2 h-0.5 w-14 rounded-full" />
        <p className="mt-2 text-sm text-muted-foreground">
          Overview of today&apos;s activity across the store.
        </p>
      </div>

      <StatTilesRow
        todaysCustomerCount={stats.todaysCustomerCount}
        totalSalesToday={stats.totalSalesToday}
        totalSalesMonth={stats.totalSalesMonth}
        birthdaysToday={birthdaysToday}
        anniversariesToday={anniversariesToday}
        repeatCustomerCount={stats.repeatCustomerCount}
        storeAverageBillValue={stats.storeAverageBillValue}
        inactiveCustomerCount={inactive30.length}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AppleCard className="flex flex-col gap-3 lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Sales — Last 30 Days
          </h2>
          <RevenueChart data={stats.dailySales} />
        </AppleCard>

        <AppleCard className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Sales by Category
          </h2>
          <CategoryBreakdownChart data={stats.salesByCategory} />
        </AppleCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MiniListCard
          title="Birthdays This Week"
          icon={Cake}
          entries={birthdays}
          viewAllHref="/lists?view=birthdays"
          emptyIcon={Cake}
          emptyTitle="No birthdays this week"
        />
        <MiniListCard
          title="Anniversaries This Week"
          icon={Heart}
          entries={anniversaries}
          viewAllHref="/lists?view=anniversaries"
          emptyIcon={Heart}
          emptyTitle="No anniversaries this week"
        />
        <NeedsAttentionCard
          inactive30={inactive30.length}
          inactive60={inactive60.length}
          inactive90={inactive90.length}
        />
      </div>
    </PageTransition>
  )
}
