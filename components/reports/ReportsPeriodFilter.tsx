"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { SegmentedControl } from "@/components/apple/SegmentedControl"
import { REPORTS_PERIOD_OPTIONS, type ReportsPeriodValue } from "@/lib/reports-period"

export interface ReportsPeriodFilterProps {
  value: ReportsPeriodValue
  className?: string
}

/**
 * Drives the whole Reports page from a single `?period=` URL param — same
 * URL-param-over-local-state pattern as `/lists`' `ListsSegmentedNav`
 * (a plain server component reading `searchParams`, no client-side
 * fetching needed). Every figure on the page (headline total, the daily
 * sales chart, the category donut, and top spenders) is fetched by the
 * page using this same period, so changing it here recomputes everything
 * consistently rather than leaving some numbers on a different window
 * than others — the exact mismatch (an all-time category donut sitting
 * under a "last 30 days" page) that prompted adding this filter.
 */
export function ReportsPeriodFilter({ value, className }: ReportsPeriodFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", next)
    router.push(`/reports?${params.toString()}`)
  }

  return (
    <SegmentedControl
      options={[...REPORTS_PERIOD_OPTIONS]}
      value={value}
      onChange={handleChange}
      className={className}
    />
  )
}
