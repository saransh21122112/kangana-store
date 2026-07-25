"use client"

import * as React from "react"
import { Users, IndianRupee, Cake, Heart, Repeat, Receipt, UserX, Eye, EyeOff, Wallet } from "lucide-react"

import { AppleCard } from "@/components/apple/AppleCard"
import { StatTile } from "@/components/apple/StatTile"
import { SegmentedControl } from "@/components/apple/SegmentedControl"
import { StaggerList, StaggerItem } from "@/components/apple/motion"
import { ICON_PROPS } from "@/lib/icon-map"
import { useHiddenValue } from "@/lib/use-hidden-value"

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

type SalesPeriod = "today" | "month" | "90days" | "6months" | "year"

const SALES_PERIOD_OPTIONS: Array<{ value: SalesPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "month", label: "This Month" },
  { value: "90days", label: "90 Days" },
  { value: "6months", label: "6 Months" },
  { value: "year", label: "Year" },
]

export interface StatTilesRowProps {
  todaysCustomerCount: number
  totalSalesToday: number
  totalSalesMonth: number
  totalSales90Days: number
  totalSales6Months: number
  totalSalesYear: number
  allTimeTotalSales: number
  birthdaysToday: number
  anniversariesToday: number
  repeatCustomerCount: number
  storeAverageBillValue: number
  inactiveCustomerCount: number
}

/**
 * Small icon-only button toggling a `useHiddenValue` flag — used on the
 * sales tiles so the figure can be blurred out when the dashboard screen is
 * visible to customers at the counter. `stopPropagation` isn't needed since
 * this button isn't nested inside another clickable element.
 */
function EyeToggleButton({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={hidden ? "Show amount" : "Hide amount"}
      aria-label={hidden ? "Show amount" : "Hide amount"}
    >
      {hidden ? <EyeOff {...ICON_PROPS} size={16} /> : <Eye {...ICON_PROPS} size={16} />}
    </button>
  )
}

/**
 * Top row of dashboard StatTiles. A client component because the
 * "Total Sales" tile toggles between five periods via a small local
 * `useState`, and both sales tiles have a persisted show/hide toggle — all
 * numbers are already server-fetched and passed in as props, so neither
 * interaction triggers a new fetch, just a re-render.
 */
export function StatTilesRow({
  todaysCustomerCount,
  totalSalesToday,
  totalSalesMonth,
  totalSales90Days,
  totalSales6Months,
  totalSalesYear,
  allTimeTotalSales,
  birthdaysToday,
  anniversariesToday,
  repeatCustomerCount,
  storeAverageBillValue,
  inactiveCustomerCount,
}: StatTilesRowProps) {
  const [salesPeriod, setSalesPeriod] = React.useState<SalesPeriod>("today")
  const salesByPeriod: Record<SalesPeriod, number> = {
    today: totalSalesToday,
    month: totalSalesMonth,
    "90days": totalSales90Days,
    "6months": totalSales6Months,
    year: totalSalesYear,
  }
  const salesValue = salesByPeriod[salesPeriod]

  const [periodSalesHidden, togglePeriodSalesHidden] = useHiddenValue("dashboard:total-sales-period-hidden")
  const [lifetimeSalesHidden, toggleLifetimeSalesHidden] = useHiddenValue("dashboard:lifetime-sales-hidden")

  const tiles: Array<{
    key: string
    label: string
    value: string | number
    icon: React.ElementType
  }> = [
    {
      key: "todays-customers",
      label: "Today's Customers",
      value: todaysCustomerCount,
      icon: Users,
    },
    {
      key: "birthdays-today",
      label: "Birthdays Today",
      value: birthdaysToday,
      icon: Cake,
    },
    {
      key: "anniversaries-today",
      label: "Anniversaries Today",
      value: anniversariesToday,
      icon: Heart,
    },
    {
      key: "repeat-customers",
      label: "Repeat Customers",
      value: repeatCustomerCount,
      icon: Repeat,
    },
    {
      key: "avg-bill-value",
      label: "Average Bill Value",
      value: currencyFormatter.format(storeAverageBillValue),
      icon: Receipt,
    },
    {
      key: "inactive-customers",
      label: "Inactive Customers (30+ days)",
      value: inactiveCustomerCount,
      icon: UserX,
    },
  ]

  return (
    <StaggerList className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StaggerItem>
        <AppleCard glow className="relative flex flex-col gap-3 overflow-hidden">
          <div className="gradient-hairline absolute inset-x-0 top-0 h-[2px]" />
          <div className="flex items-start justify-between gap-4">
            <StatTile
              label="Total Sales"
              value={periodSalesHidden ? "••••••" : currencyFormatter.format(salesValue)}
              valueClassName="glow-text"
            />
            <div className="flex shrink-0 items-center gap-1">
              <EyeToggleButton hidden={periodSalesHidden} onToggle={togglePeriodSalesHidden} />
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent dark:shadow-[0_0_16px_0_var(--accent)]">
                <IndianRupee {...ICON_PROPS} size={22} />
              </div>
            </div>
          </div>
          <SegmentedControl
            options={SALES_PERIOD_OPTIONS}
            value={salesPeriod}
            onChange={(v) => setSalesPeriod(v as SalesPeriod)}
            className="self-start"
          />
        </AppleCard>
      </StaggerItem>

      <StaggerItem>
        <AppleCard glow className="flex items-start justify-between gap-4">
          <StatTile
            label="Lifetime Sales"
            value={lifetimeSalesHidden ? "••••••" : currencyFormatter.format(allTimeTotalSales)}
            valueClassName="glow-text"
          />
          <div className="flex shrink-0 items-center gap-1">
            <EyeToggleButton hidden={lifetimeSalesHidden} onToggle={toggleLifetimeSalesHidden} />
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Wallet {...ICON_PROPS} size={22} />
            </div>
          </div>
        </AppleCard>
      </StaggerItem>

      {tiles.map((tile) => (
        <StaggerItem key={tile.key}>
          <AppleCard glow className="flex items-start justify-between gap-4">
            <StatTile label={tile.label} value={tile.value} />
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <tile.icon {...ICON_PROPS} size={22} />
            </div>
          </AppleCard>
        </StaggerItem>
      ))}
    </StaggerList>
  )
}
