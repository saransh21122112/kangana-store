import { formatDistanceToNow } from "date-fns"

import { EmptyState } from "@/components/apple/EmptyState"
import { History } from "lucide-react"

export interface ActivityLogRow {
  id: string
  userEmail: string | null
  action: string
  summary: string
  createdAt: string | Date
}

export interface ActivityLogTableProps {
  entries: ActivityLogRow[]
}

/**
 * OWNER-only audit trail (Stage 21) — read-only, no filters/pagination yet
 * (capped at the 100 most recent by `getRecentActivity()`, plenty for a
 * single-showroom CRM's realistic activity volume). `userEmail` is a
 * denormalized snapshot taken at the time of the action, not a live lookup
 * — see `lib/queries/activity-log.ts` for why (a log entry stays
 * meaningful even after that User account is later deleted).
 */
export function ActivityLogTable({ entries }: ActivityLogTableProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Customer and bill changes will show up here as they happen."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Who</th>
            <th className="px-4 py-3">What</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{entry.userEmail ?? "Unknown"}</td>
              <td className="px-4 py-3 text-foreground">{entry.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
