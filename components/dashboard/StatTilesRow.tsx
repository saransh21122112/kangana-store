"use client"

import * as React from "react"
import { Users, IndianRupee, Cake, Heart, Repeat, Receipt, UserX } from "lucide-react"

import { AppleCard } from "@/components/apple/AppleCard"
import { StatTile } from "@/components/apple/StatTile"
import { SegmentedControl } from "@/components/apple/SegmentedControl"
import { StaggerList, StaggerItem } from "@/components/apple/motion"
import { ICON_PROPS } from "@/lib/icon-map"

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

export interface StatTilesRowProps {
  todaysCustomerCount: number
  totalSalesToday: number
  totalSalesMonth: number
  birthdaysToday: number
  anniversariesToday: number
  repeatCustomerCount: number
  storeAverageBillValue: number
  inactiveCustomerCount: number
}

/**
 * Top row of dashboard StatTiles. A client component only because the
 * "Total Sales" tile toggles between Today/This Month via a small local
 * `useState` — both numbers are already server-fetched and passed in as
 * props, so the toggle never triggers a new fetch, just a re-render.
 */
export function StatTilesRow({
  todaysCustomerCount,
  totalSalesToday,
  totalSalesMonth,
  birthdaysToday,
  anniversariesToday,
  repeatCustomerCount,
  storeAverageBillValue,
  inactiveCustomerCount,
}: StatTilesRowProps) {
  const [salesPeriod, setSalesPeriod] = React.useState<"today" | "month">("today")
  const salesValue = salesPeriod === "today" ? totalSalesToday : totalSalesMonth

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
        <AppleCard className="relative flex flex-col gap-3 overflow-hidden">
          <div className="gradient-hairline absolute inset-x-0 top-0 h-[2px]" />
          <div className="flex items-start justify-between gap-4">
            <StatTile
              label="Total Sales"
              value={currencyFormatter.format(salesValue)}
            />
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <IndianRupee {...ICON_PROPS} size={22} />
            </div>
          </div>
          <SegmentedControl
            options={[
              { value: "today", label: "Today" },
              { value: "month", label: "This Month" },
            ]}
            value={salesPeriod}
            onChange={(v) => setSalesPeriod(v as "today" | "month")}
            className="self-start"
          />
        </AppleCard>
      </StaggerItem>

      {tiles.map((tile) => (
        <StaggerItem key={tile.key}>
          <AppleCard className="flex items-start justify-between gap-4">
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
