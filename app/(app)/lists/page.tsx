import { Cake, Heart, UserX, Trophy, UserPlus2 } from "lucide-react"

import {
  getBirthdaysThisWeek,
  getAnniversariesThisWeek,
  getInactiveCustomers,
  getTopSpenders,
  getNewCustomersThisMonth,
} from "@/lib/queries/customer-lists"
import { AppleCard } from "@/components/apple/AppleCard"
import { AuroraBackground } from "@/components/apple/AuroraBackground"
import { ListsSegmentedNav } from "@/components/lists/ListsSegmentedNav"
import { CustomerListTable, type CustomerListRow } from "@/components/lists/CustomerListTable"

const VIEW_OPTIONS = [
  { value: "birthdays", label: "Birthdays" },
  { value: "anniversaries", label: "Anniversaries" },
  { value: "inactive", label: "Inactive" },
  { value: "top-spenders", label: "Top Spenders" },
  { value: "new", label: "New This Month" },
] as const

type ViewValue = (typeof VIEW_OPTIONS)[number]["value"]

const INACTIVE_DAY_OPTIONS = [
  { value: "30", label: "30+ days" },
  { value: "60", label: "60+ days" },
  { value: "90", label: "90+ days" },
] as const

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const monthYearFormatter = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" })

function isViewValue(value: string | undefined): value is ViewValue {
  return VIEW_OPTIONS.some((o) => o.value === value)
}

function daysLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Today"
  if (daysUntil === 1) return "Tomorrow"
  return `In ${daysUntil} days`
}

interface ListsPageProps {
  searchParams: Promise<{ view?: string; days?: string }>
}

// See app/(app)/(dashboard)/page.tsx for why this is needed: without it,
// Next statically prerenders this page at build time and these
// birthday/anniversary/inactive/top-spender lists never update in production.
export const dynamic = "force-dynamic"

export default async function ListsPage({ searchParams }: ListsPageProps) {
  const params = await searchParams
  const view: ViewValue = isViewValue(params.view) ? params.view : "birthdays"
  const inactiveDays = params.days === "60" || params.days === "90" ? Number(params.days) as 60 | 90 : 30

  let rows: CustomerListRow[] = []
  let emptyIcon = Cake
  let emptyTitle = "Nothing here"
  let emptyDescription: string | undefined

  if (view === "birthdays") {
    const entries = await getBirthdaysThisWeek()
    rows = entries.map(({ customer, daysUntil }) => ({
      customer,
      metricLabel: `Birthday · ${daysLabel(daysUntil)}`,
      metricVariant: "vip" as const,
    }))
    emptyIcon = Cake
    emptyTitle = "No birthdays this week"
    emptyDescription = "No customer has a birthday in the next 7 days."
  } else if (view === "anniversaries") {
    const entries = await getAnniversariesThisWeek()
    rows = entries.map(({ customer, daysUntil }) => ({
      customer,
      metricLabel: `Anniversary · ${daysLabel(daysUntil)}`,
      metricVariant: "vip" as const,
    }))
    emptyIcon = Heart
    emptyTitle = "No anniversaries this week"
    emptyDescription = "No customer has an anniversary in the next 7 days."
  } else if (view === "inactive") {
    const entries = await getInactiveCustomers(inactiveDays as 30 | 60 | 90)
    rows = entries.map(({ customer, daysSinceLastVisit }) => ({
      customer,
      metricLabel:
        daysSinceLastVisit === null ? "Never visited" : `Last visit ${daysSinceLastVisit} days ago`,
      metricVariant: "warning" as const,
    }))
    emptyIcon = UserX
    emptyTitle = `No customers inactive ${inactiveDays}+ days`
    emptyDescription = "Everyone has visited recently at this threshold."
  } else if (view === "top-spenders") {
    const customers = await getTopSpenders(20)
    rows = customers.map((customer) => ({
      customer,
      metricLabel: `${currencyFormatter.format(customer.totalPurchaseAmount)} spent`,
      metricVariant: "success" as const,
    }))
    emptyIcon = Trophy
    emptyTitle = "No spenders yet"
    emptyDescription = "No customer has any recorded purchases yet."
  } else if (view === "new") {
    const customers = await getNewCustomersThisMonth()
    rows = customers.map((customer) => ({
      customer,
      metricLabel: `Member since ${monthYearFormatter.format(new Date(customer.customerSince))}`,
      metricVariant: "default" as const,
    }))
    emptyIcon = UserPlus2
    emptyTitle = "No new customers this month"
    emptyDescription = "No customer has joined so far this calendar month."
  }

  return (
    <div className="relative flex flex-col gap-6">
      <AuroraBackground />

      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Lists</h1>
        <div className="gradient-hairline mt-2 h-0.5 w-14 rounded-full" />
        <p className="mt-2 text-sm text-muted-foreground">
          Automatic customer lists for birthdays, anniversaries, inactivity, spend, and new sign-ups.
        </p>
      </div>

      <AppleCard glow noPadding className="flex flex-col gap-4 p-4">
        <ListsSegmentedNav paramName="view" options={[...VIEW_OPTIONS]} value={view} />
        {view === "inactive" && (
          <ListsSegmentedNav
            paramName="days"
            options={[...INACTIVE_DAY_OPTIONS]}
            value={String(inactiveDays)}
            className="self-start"
          />
        )}
      </AppleCard>

      <CustomerListTable
        rows={rows}
        emptyIcon={emptyIcon}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    </div>
  )
}
