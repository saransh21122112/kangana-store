import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getSettings } from "@/lib/queries/settings"
import { getRecentActivity } from "@/lib/queries/activity-log"
import { prisma } from "@/lib/prisma"
import { AuroraBackground } from "@/components/apple/AuroraBackground"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import type { UserRow } from "@/components/settings/UserManagementTable"
import type { ActivityLogRow } from "@/components/settings/ActivityLogTable"

/**
 * Settings page (Stage 9's final integration). Server component: fetches
 * `AppSettings` unconditionally, and the user list only when the viewer is
 * OWNER (STAFF has no legitimate reason to see it, and `SettingsTabs` hides
 * that tab entirely for them anyway — fetching it server-side for STAFF
 * would just be wasted work). `middleware.ts` only checks "logged in", not
 * role, so STAFF can reach this route; role-based rendering happens here.
 * VIEWER is excluded entirely (redirected below) — unlike STAFF, VIEWER has
 * no legitimate reason to see even the read-only Store Profile/Categories/
 * Thresholds tabs.
 */
// See app/(app)/(dashboard)/page.tsx for why this is needed: without it,
// Next statically prerenders this page at build time and settings/user
// changes never show up here on reload in production.
export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await auth()
  const isOwner = session?.user?.role === "OWNER"

  if (session?.user.role === "VIEWER") {
    redirect("/customers")
  }

  const [settings, users, activity] = await Promise.all([
    getSettings(),
    isOwner
      ? prisma.user.findMany({
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    isOwner ? getRecentActivity() : Promise.resolve([]),
  ])

  const initialUsers: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  }))

  const initialActivity: ActivityLogRow[] = activity.map((entry) => ({
    id: entry.id,
    userEmail: entry.userEmail,
    action: entry.action,
    summary: entry.summary,
    createdAt: entry.createdAt,
  }))

  return (
    <div className="relative flex flex-col gap-6">
      <AuroraBackground />

      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
        <div className="gradient-hairline mt-2 h-0.5 w-14 rounded-full" />
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your store profile, bill categories, inactive-customer thresholds, team members,
          and data exports.
        </p>
      </div>

      <SettingsTabs
        isOwner={isOwner}
        storeProfileDefaults={{
          storeName: settings.storeName,
          logoUrl: settings.logoUrl,
          accentColor: settings.accentColor,
        }}
        categories={settings.categories}
        thresholdsDefaults={{
          inactiveThreshold30: settings.inactiveThreshold30,
          inactiveThreshold60: settings.inactiveThreshold60,
          inactiveThreshold90: settings.inactiveThreshold90,
        }}
        initialUsers={initialUsers}
        initialActivity={initialActivity}
      />
    </div>
  )
}
