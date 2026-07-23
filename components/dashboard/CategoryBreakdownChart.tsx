"use client"

import * as React from "react"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts"

import type { CategorySales } from "@/lib/queries/dashboard-stats"
import { EmptyState } from "@/components/apple/EmptyState"
import { PieChart as PieChartIcon } from "lucide-react"

export interface CategoryBreakdownChartProps {
  data: CategorySales[]
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

/**
 * Fixed, consistent category color palette. Reuses the Stage 1 status
 * tokens (`--accent`/`--success`/`--warning`/`--danger`/`--vip`) plus two
 * extra fixed hex swatches matching `Avatar`'s palette (already chosen to
 * be legible in both light and dark mode) so this never runs out of
 * distinct colors even if new bill categories are added later.
 */
const CATEGORY_COLORS = [
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "var(--vip)",
  "#5AC8FA",
  "#FFD60A",
]

/**
 * Donut chart of sales-by-category. Client component because Recharts
 * needs the browser; the page fetches the data server-side and passes it
 * in as props.
 */
export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  const total = data.reduce((sum, d) => sum + d.total, 0)

  if (data.length === 0 || total === 0) {
    return (
      <EmptyState
        icon={PieChartIcon}
        title="No sales yet"
        description="Category breakdown will appear once bills are recorded."
      />
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              color: "var(--card-foreground)",
              fontSize: 13,
            }}
            formatter={(value, name) => [currencyFormatter.format(Number(value)), String(name)]}
          />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
