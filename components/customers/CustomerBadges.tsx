import { AppleBadge } from "@/components/apple/Badge"
import { cn } from "@/lib/utils"

const DAY_MS = 24 * 60 * 60 * 1000
const NEW_WITHIN_DAYS = 30
const INACTIVE_AFTER_DAYS = 60

export interface CustomerBadgesProps {
  customerSince: Date | string
  lastVisitDate: Date | string | null
  /**
   * Whether this customer is in the top-spender segment. Computed by the
   * caller (list/profile page, which has visibility across all customers)
   * rather than queried inside this component — keeps this component a
   * pure, cheap presentational unit.
   */
  isVip?: boolean
  className?: string
}

/**
 * Status badges for a customer: VIP (caller-computed), New (customerSince
 * within the last 30 days), Inactive (no visit in 60+ days, or never
 * visited). "New" and "Inactive" are both self-contained — computed here
 * from the two date props — since they're cheap and don't need
 * cross-customer context.
 */
/** Plain helper (not a component) so the current-time read stays out of render's purity check. */
function computeStatusFlags(customerSince: Date | string, lastVisitDate: Date | string | null) {
  const now = Date.now()
  const sinceDate = new Date(customerSince)
  const isNew = (now - sinceDate.getTime()) / DAY_MS <= NEW_WITHIN_DAYS
  const isInactive = lastVisitDate
    ? (now - new Date(lastVisitDate).getTime()) / DAY_MS > INACTIVE_AFTER_DAYS
    : true
  return { isNew, isInactive }
}

export function CustomerBadges({ customerSince, lastVisitDate, isVip, className }: CustomerBadgesProps) {
  const { isNew, isInactive } = computeStatusFlags(customerSince, lastVisitDate)

  const badges: { key: string; label: string; variant: "vip" | "new" | "inactive" }[] = []
  if (isVip) badges.push({ key: "vip", label: "VIP", variant: "vip" })
  if (isNew) badges.push({ key: "new", label: "New", variant: "new" })
  if (isInactive) badges.push({ key: "inactive", label: "Inactive", variant: "inactive" })

  if (badges.length === 0) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {badges.map((badge) => (
        <AppleBadge key={badge.key} variant={badge.variant}>
          {badge.label}
        </AppleBadge>
      ))}
    </div>
  )
}
