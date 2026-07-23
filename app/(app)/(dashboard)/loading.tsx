import { AppleCard } from "@/components/apple/AppleCard"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Apple-style shimmering loading skeleton for the dashboard route,
 * mirroring its real layout: header, 7-tile stat row, two charts, and the
 * mini-list/needs-attention row.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <AppleCard key={i} className="flex items-start justify-between gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="size-10 shrink-0 rounded-full" />
          </AppleCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AppleCard className="flex flex-col gap-3 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-64 w-full" />
        </AppleCard>
        <AppleCard className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-64 w-full" />
        </AppleCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <AppleCard key={i} className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </AppleCard>
        ))}
      </div>
    </div>
  )
}
