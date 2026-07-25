import Link from "next/link"
import { UserX, ChevronRight } from "lucide-react"

import { AppleCard } from "@/components/apple/AppleCard"
import { ICON_PROPS } from "@/lib/icon-map"

export interface NeedsAttentionCardProps {
  inactive30: number
  inactive60: number
  inactive90: number
}

const THRESHOLDS: Array<{ days: 30 | 60 | 90; label: string }> = [
  { days: 30, label: "30+ days inactive" },
  { days: 60, label: "60+ days inactive" },
  { days: 90, label: "90+ days inactive" },
]

/**
 * "Needs Attention" card: inactive-customer counts at the 30/60/90-day
 * thresholds, each linking to the matching Stage 5 `/lists` view (same
 * `view`/`days` query param convention as `ListsSegmentedNav`).
 */
export function NeedsAttentionCard({ inactive30, inactive60, inactive90 }: NeedsAttentionCardProps) {
  const counts: Record<30 | 60 | 90, number> = {
    30: inactive30,
    60: inactive60,
    90: inactive90,
  }

  return (
    <AppleCard glow noPadding className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
          <UserX {...ICON_PROPS} size={16} />
        </div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">Needs Attention</h2>
      </div>

      <div className="flex flex-col gap-1">
        {THRESHOLDS.map(({ days, label }) => (
          <Link
            key={days}
            href={`/lists?view=inactive&days=${days}`}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted"
          >
            <span className="text-sm text-foreground">{label}</span>
            <span className="flex items-center gap-1 text-sm font-semibold text-warning">
              {counts[days]}
              <ChevronRight {...ICON_PROPS} size={14} className="text-muted-foreground" />
            </span>
          </Link>
        ))}
      </div>
    </AppleCard>
  )
}
