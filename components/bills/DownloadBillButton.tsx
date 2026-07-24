"use client"

import { Download } from "lucide-react"

import { ICON_PROPS } from "@/lib/icon-map"
import { cn } from "@/lib/utils"

export interface DownloadBillButtonProps {
  billId: string
}

/**
 * Small inline icon-only download button for a single bill row, visible to
 * every role (OWNER/STAFF/VIEWER) — mirrors `DeleteBillButton`'s visual
 * pattern but is a plain anchor rather than a fetch-driven client action:
 * `GET /api/bills/[id]/pdf` returns the file directly with a
 * `Content-Disposition: attachment` header, so the browser handles the
 * download natively with no JS needed.
 */
export function DownloadBillButton({ billId }: DownloadBillButtonProps) {
  return (
    <a
      href={`/api/bills/${billId}/pdf`}
      aria-label="Download bill as PDF"
      title="Download bill as PDF"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
      )}
    >
      <Download {...ICON_PROPS} size={16} />
    </a>
  )
}
