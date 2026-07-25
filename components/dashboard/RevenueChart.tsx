"use client"

import * as React from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

import type { DailySales } from "@/lib/queries/dashboard-stats"

export interface RevenueChartProps {
  data: DailySales[]
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

function formatDayLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-")
  const date = new Date(Number(dateKey.slice(0, 4)), Number(m) - 1, Number(d))
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

/**
 * Daily sales as an area chart — originally always a fixed 30-day window,
 * now also used by the Reports page's period filter (30/60/90/365 days),
 * so `data.length` varies a lot more than it used to. Client component
 * because Recharts needs the browser; the page fetches the data
 * server-side and passes it in as props.
 *
 * Colors come from the Stage 1 CSS variable tokens (`--accent`, etc.) via
 * `var(...)`, rather than hardcoded hex, so the chart automatically
 * matches light/dark mode without a separate dark-mode chart theme.
 */
export function RevenueChart({ data }: RevenueChartProps) {
  const chartData = React.useMemo(
    () => data.map((d) => ({ ...d, label: formatDayLabel(d.date) })),
    [data]
  )
  // Aim for ~8 visible X-axis labels regardless of range — a fixed
  // `interval={4}` (right for 30 daily points) would either waste space
  // (too few labels) on a 60/90-day view or overlap into an unreadable
  // smear on the 365-day "This Year" view.
  const tickInterval = Math.max(0, Math.ceil(chartData.length / 8) - 1)

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              color: "var(--card-foreground)",
              fontSize: 13,
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(value) => [currencyFormatter.format(Number(value)), "Sales"]}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#revenueFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
