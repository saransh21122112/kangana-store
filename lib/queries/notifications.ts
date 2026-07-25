import { prisma } from "@/lib/prisma";
import type { OwnerNotification } from "@/lib/generated/prisma/client";

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface CreateNotificationInput {
  /**
   * Free-text `type` field. Dedup scheme (documented in full here since the
   * `OwnerNotification` model has no dedicated dedup fields — see
   * MEMORY.md's Stage 8 section for the same writeup):
   *
   * `type` is expected to embed a stable identifier for whatever this
   * notification is *about*, e.g. `"birthday:<customerId>"`,
   * `"inactive-30:<customerId>"`, `"vip:<customerId>"`. Two notifications
   * are considered duplicates of each other if they have the **exact same
   * `type` string** and the existing one was created within the last 24
   * hours. This is a workaround, not a schema-level guarantee — it's the
   * simplest approach that needs no migration, per the brief.
   */
  type: string;
  message: string;
}

export type CreateNotificationResult =
  | { created: true; notification: OwnerNotification }
  | { created: false; reason: "duplicate" };

/**
 * Inserts a new `OwnerNotification` unless one with the same exact `type`
 * already exists, created within the last 24 hours — see
 * `CreateNotificationInput.type`'s doc comment for the full dedupe-key
 * scheme. Every notification the cron route creates goes through this
 * function so re-running the cron job on the same day is a no-op.
 */
export async function createNotificationIfNotExists(
  data: CreateNotificationInput
): Promise<CreateNotificationResult> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);

  const existing = await prisma.ownerNotification.findFirst({
    where: { type: data.type, createdAt: { gte: since } },
    select: { id: true },
  });

  if (existing) {
    return { created: false, reason: "duplicate" };
  }

  const notification = await prisma.ownerNotification.create({
    data: { type: data.type, message: data.message },
  });

  return { created: true, notification };
}

export interface BatchNotificationResult {
  created: number;
  skipped: number;
}

/**
 * Batched variant of `createNotificationIfNotExists` for call sites that may
 * have a large (hundreds/thousands) candidate list — the low-stock cron
 * check, in particular, went from a handful of items to several thousand
 * once the store's full product catalog was bulk-imported into
 * `InventoryItem`. Calling `createNotificationIfNotExists` in a loop means 2
 * sequential Neon round-trips per item; at that volume the daily cron route
 * would take minutes and risk exceeding the serverless function's execution
 * time limit. This does the same dedupe-by-type-within-24h logic in exactly
 * 2 queries total, regardless of how many candidates are passed in.
 */
export async function createNotificationsIfNotExistsBatch(
  items: CreateNotificationInput[]
): Promise<BatchNotificationResult> {
  if (items.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const existing = await prisma.ownerNotification.findMany({
    where: { type: { in: items.map((i) => i.type) }, createdAt: { gte: since } },
    select: { type: true },
  });
  const existingTypes = new Set(existing.map((e) => e.type));

  const toCreate = items.filter((i) => !existingTypes.has(i.type));
  if (toCreate.length > 0) {
    await prisma.ownerNotification.createMany({ data: toCreate });
  }

  return { created: toCreate.length, skipped: items.length - toCreate.length };
}

/** Unread notifications, most recent first — for the bell's dropdown/list and its badge count. */
export async function getUnreadNotifications(): Promise<OwnerNotification[]> {
  return prisma.ownerNotification.findMany({
    where: { isRead: false },
    orderBy: { createdAt: "desc" },
  });
}

/** All notifications, most recent first, capped at `limit`. */
export async function getAllNotifications(limit = 50): Promise<OwnerNotification[]> {
  return prisma.ownerNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Marks every currently-unread notification as read. Returns the count updated. */
export async function markAllRead(): Promise<number> {
  const result = await prisma.ownerNotification.updateMany({
    where: { isRead: false },
    data: { isRead: true },
  });
  return result.count;
}

/** Marks a single notification as read by id. */
export async function markOneRead(id: string): Promise<OwnerNotification> {
  return prisma.ownerNotification.update({
    where: { id },
    data: { isRead: true },
  });
}
