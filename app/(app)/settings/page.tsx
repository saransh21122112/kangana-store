import { auth } from "@/lib/auth"
import { getSettings } from "@/lib/queries/settings"
import { prisma } from "@/lib/prisma"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import type { UserRow } from "@/components/settings/UserManagementTable"

/**
 * Settings page (Stage 9's final integration). Server component: fetches
 * `AppSettings` unconditionally, and the user list only when the viewer is
 * OWNER (STAFF has no legitimate reason to see it, and `SettingsTabs` hides
 * that tab entirely for them anyway — fetching it server-side for STAFF
 * would just be wasted work). `middleware.ts` only checks "logged in", not
 * role, so STAFF can reach this route; role-based rendering happens here.
 */
export default async function SettingsPage() {
  const session = await auth()
  const isOwner = session?.user?.role === "OWNER"

  const [settings, users] = await Promise.all([
    getSettings(),
    isOwner
      ? prisma.user.findMany({
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ])

  const initialUsers: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
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
      />
    </div>
  )
}
