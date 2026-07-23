import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Phone, MessageCircle, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { ICON_PROPS } from "@/lib/icon-map"
import { AppleCard } from "@/components/apple/AppleCard"
import { Avatar } from "@/components/apple/Avatar"
import { EmptyState } from "@/components/apple/EmptyState"
import { StaggerList, StaggerItem } from "@/components/apple/motion"

function waLink(mobileNumber: string): string {
  return `https://wa.me/91${mobileNumber}`
}

export type CustomerListMetricVariant = "default" | "warning" | "success" | "vip"

/**
 * One row's worth of display data. Deliberately generic across all 5 list
 * types (birthdays/anniversaries/inactive/top-spenders/new-this-month)
 * rather than 5 near-identical row shapes — each list page computes its own
 * `metricLabel` (e.g. "Birthday in 2 days", "Last visit 45 days ago",
 * "₹48,200 spent", "Member since Jul 2026") and passes it in, so this
 * component only needs to know how to render "identity + one metric +
 * actions", not the domain logic behind the metric.
 */
export interface CustomerListRow {
  customer: {
    id: string
    name: string
    mobileNumber: string
  }
  metricLabel: string
  metricVariant?: CustomerListMetricVariant
}

export interface CustomerListTableProps {
  rows: CustomerListRow[]
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription?: string
  className?: string
}

const metricVariantClasses: Record<CustomerListMetricVariant, string> = {
  default: "text-foreground",
  warning: "text-warning",
  success: "text-success",
  vip: "text-vip",
}

/**
 * Reusable list/table for all Stage 5 automatic customer lists: Avatar,
 * Name, Mobile, a per-list metric string, and quick actions (Call,
 * WhatsApp, View Profile). WhatsApp here is a plain `wa.me` link with no
 * pre-filled message — Stage 6 builds the templated-message composer.
 */
export function CustomerListTable({
  rows,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  className,
}: CustomerListTableProps) {
  if (rows.length === 0) {
    return (
      <AppleCard>
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      </AppleCard>
    )
  }

  return (
    <StaggerList className={cn("flex flex-col gap-2", className)}>
      {rows.map(({ customer, metricLabel, metricVariant = "default" }) => (
        <StaggerItem key={customer.id}>
          <AppleCard noPadding className="flex items-center gap-3 p-3 sm:p-4">
            <Link
              href={`/customers/${customer.id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <Avatar name={customer.name} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{customer.name}</span>
                <span className="text-xs text-muted-foreground">{customer.mobileNumber}</span>
              </div>
            </Link>

            <span
              className={cn(
                "shrink-0 text-right text-xs font-medium sm:text-sm",
                metricVariantClasses[metricVariant]
              )}
            >
              {metricLabel}
            </span>

            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={`tel:${customer.mobileNumber}`}
                className="flex size-8 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
                title="Call"
              >
                <Phone {...ICON_PROPS} size={15} />
              </a>
              <a
                href={waLink(customer.mobileNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-8 items-center justify-center rounded-full border border-border text-success hover:bg-muted"
                title="WhatsApp"
              >
                <MessageCircle {...ICON_PROPS} size={15} />
              </a>
              <Link
                href={`/customers/${customer.id}`}
                className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
                title="View profile"
              >
                <ChevronRight {...ICON_PROPS} size={15} />
              </Link>
            </div>
          </AppleCard>
        </StaggerItem>
      ))}
    </StaggerList>
  )
}
