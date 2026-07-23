import { prisma } from "@/lib/prisma";
import type { AppSettings } from "@/lib/generated/prisma/client";

/**
 * Fixed id for the single settings row — this project deliberately has no
 * multi-tenant concept, so a literal singleton id (rather than a real
 * lookup) is the simplest way to guarantee "at most one row".
 */
const SETTINGS_ID = "singleton";

/**
 * Returns the one `AppSettings` row, creating it (with schema defaults) on
 * first read if it doesn't exist yet. This "lazy create" approach was
 * chosen over a migration-time seed script so that `getSettings()` is the
 * single source of truth for "does the row exist" — no separate seed step
 * to remember to run, and it self-heals if the row is ever deleted.
 */
export async function getSettings(): Promise<AppSettings> {
  const existing = await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;

  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

export interface UpdateSettingsInput {
  storeName?: string;
  logoUrl?: string | null;
  accentColor?: string;
  categories?: string[];
  inactiveThreshold30?: number;
  inactiveThreshold60?: number;
  inactiveThreshold90?: number;
}

/** Partial update of the singleton settings row — creates it first if missing. */
export async function updateSettings(data: UpdateSettingsInput): Promise<AppSettings> {
  await getSettings(); // ensure row exists
  return prisma.appSettings.update({
    where: { id: SETTINGS_ID },
    data,
  });
}
