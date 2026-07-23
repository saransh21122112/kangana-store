import * as React from "react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

import { cn } from "@/lib/utils"
import { ICON_PROPS } from "@/lib/icon-map"

export type StatTrend = "up" | "down" | "neutral"

export interface StatTileProps {
  label: string
  value: string | number
  trend?: StatTrend
  /** e.g. "+12% vs last week" */
  trendLabel?: string
  className?: string
}

const trendConfig: Record<StatTrend, { icon: React.ElementType; className: string }> = {
  up: { icon: ArrowUpRight, className: "text-success" },
  down: { icon: ArrowDownRight, className: "text-danger" },
  neutral: { icon: Minus, className: "text-muted-foreground" },
}

/**
 * Big number + label + optional trend indicator. Meant to sit inside an
 * AppleCard on the dashboard (e.g. "Today's Customers", "Total Sales").
 */
export function StatTile({ label, value, trend, trendLabel, className }: StatTileProps) {
  const Trend = trend ? trendConfig[trend] : null

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </span>
      {Trend && trendLabel && (
        <span className={cn("flex items-center gap-1 text-xs font-medium", Trend.className)}>
          <Trend.icon {...ICON_PROPS} size={14} />
          {trendLabel}
        </span>
      )}
    </div>
  )
}
