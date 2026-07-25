/**
 * Shared between the (server) Reports page and the (client)
 * `ReportsPeriodFilter` component — kept in its own plain module rather
 * than exported from the `"use client"` component file, since everything
 * exported from a client-component file is bundled for the client and
 * can't be called from server code (confirmed the hard way: importing
 * `isReportsPeriodValue` from `ReportsPeriodFilter.tsx` into the server
 * page threw "Attempted to call ... from the server but ... is on the
 * client").
 */
export const REPORTS_PERIOD_OPTIONS = [
  { value: "30", label: "30 Days" },
  { value: "60", label: "60 Days" },
  { value: "90", label: "90 Days" },
  { value: "365", label: "This Year" },
] as const

export type ReportsPeriodValue = (typeof REPORTS_PERIOD_OPTIONS)[number]["value"]

export function isReportsPeriodValue(value: string | undefined): value is ReportsPeriodValue {
  return REPORTS_PERIOD_OPTIONS.some((o) => o.value === value)
}
