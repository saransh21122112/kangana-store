"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { SegmentedControl, type SegmentedControlOption } from "@/components/apple/SegmentedControl"

export interface ListsSegmentedNavProps {
  /** Search-param key this control drives, e.g. "view" or "days". */
  paramName: string
  options: SegmentedControlOption[]
  value: string
  className?: string
}

/**
 * Thin client wrapper around Stage 1's `SegmentedControl` that drives a URL
 * search param instead of local state. The Lists page (`app/(app)/lists/
 * page.tsx`) stays a plain server component that reads `searchParams` and
 * fetches directly from `lib/queries/customer-lists.ts` — no client-side
 * data fetching or extra API route needed, since `SegmentedControl` is
 * already `"use client"` and all this needs to do is turn a click into a
 * navigation.
 */
export function ListsSegmentedNav({ paramName, options, value, className }: ListsSegmentedNavProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(paramName, next)
    router.push(`/lists?${params.toString()}`)
  }

  return <SegmentedControl options={options} value={value} onChange={handleChange} className={className} />
}
