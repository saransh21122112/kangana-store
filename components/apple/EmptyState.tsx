import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { ICON_PROPS } from "@/lib/icon-map"
import { AppleButton } from "@/components/apple/AppleButton"

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  ctaLabel?: string
  onCtaClick?: () => void
  className?: string
}

/** Icon + message + optional CTA, for empty lists/tables/search results. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon {...ICON_PROPS} size={24} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {ctaLabel && onCtaClick && (
        <AppleButton size="sm" onClick={onCtaClick} className="mt-2">
          {ctaLabel}
        </AppleButton>
      )}
    </div>
  )
}
