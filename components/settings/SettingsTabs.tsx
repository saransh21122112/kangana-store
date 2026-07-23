"use client"

import * as React from "react"
import { Download, Lock } from "lucide-react"

import { SegmentedControl, type SegmentedControlOption } from "@/components/apple/SegmentedControl"
import { AppleCard } from "@/components/apple/AppleCard"
import { EmptyState } from "@/components/apple/EmptyState"
import { StoreProfileForm } from "@/components/settings/StoreProfileForm"
import { CategoryManager } from "@/components/settings/CategoryManager"
import { ThresholdsForm } from "@/components/settings/ThresholdsForm"
import { UserManagementTable, type UserRow } from "@/components/settings/UserManagementTable"
import { ICON_PROPS } from "@/lib/icon-map"

export interface SettingsTabsProps {
  isOwner: boolean
  storeProfileDefaults: {
    storeName: string
    logoUrl: string | null
    accentColor: string
  }
  categories: string[]
  thresholdsDefaults: {
    inactiveThreshold30: number
    inactiveThreshold60: number
    inactiveThreshold90: number
  }
  /** Only populated (by the server component) when the viewer is OWNER. */
  initialUsers: UserRow[]
}

const BASE_OPTIONS: SegmentedControlOption[] = [
  { value: "profile", label: "Store Profile" },
  { value: "categories", label: "Categories" },
  { value: "thresholds", label: "Thresholds" },
  { value: "users", label: "Users" },
  { value: "export", label: "Export" },
]

/**
 * Client wrapper driving the Settings page's `SegmentedControl`, following
 * the same tab-switcher convention `CustomerProfileTabs` established
 * (controlled `value`/`onChange` inside an `AppleCard`, not shadcn's
 * `tabs`). The "Users" tab option is omitted entirely for STAFF viewers
 * (rather than shown-but-gated) — cleaner given `SegmentedControl`'s plain
 * options-array API, and STAFF has no legitimate use for this tab at all.
 */
export function SettingsTabs({
  isOwner,
  storeProfileDefaults,
  categories,
  thresholdsDefaults,
  initialUsers,
}: SettingsTabsProps) {
  const options = isOwner ? BASE_OPTIONS : BASE_OPTIONS.filter((opt) => opt.value !== "users")
  const [tab, setTab] = React.useState<string>(options[0].value)

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl options={options} value={tab} onChange={setTab} />

      <AppleCard>
        {tab === "profile" && <StoreProfileForm defaultValues={storeProfileDefaults} />}

        {tab === "categories" && <CategoryManager defaultCategories={categories} />}

        {tab === "thresholds" && <ThresholdsForm defaultValues={thresholdsDefaults} />}

        {tab === "users" &&
          (isOwner ? (
            <UserManagementTable initialUsers={initialUsers} />
          ) : (
            <EmptyState
              icon={Lock}
              title="Owner access required"
              description="Only the store owner can view and manage team member accounts."
            />
          ))}

        {tab === "export" && (
          <div className="flex flex-col gap-4 max-w-md">
            <div>
              <p className="text-base font-semibold tracking-tight text-foreground">Export Data</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Download your full customer list or billing history as a CSV file, ready to open
                in Excel or Google Sheets.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href="/api/export/customers"
                download
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
              >
                <Download {...ICON_PROPS} size={18} />
                Export Customers as CSV
              </a>
              <a
                href="/api/export/bills"
                download
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
              >
                <Download {...ICON_PROPS} size={18} />
                Export Bills as CSV
              </a>
            </div>
          </div>
        )}
      </AppleCard>
    </div>
  )
}
