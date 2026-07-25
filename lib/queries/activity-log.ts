import { prisma } from "@/lib/prisma";
import type { ActivityLog } from "@/lib/generated/prisma/client";

export interface LogActivityInput {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
}

/**
 * Who-did-what audit trail (Stage 21), OWNER-only visibility. Called from
 * each Customer/Bill mutation API route after the mutation succeeds — not
 * inside the same transaction as the mutation itself, since a logging
 * failure should never roll back (or even be allowed to block) a real
 * business action. `userEmail` is a denormalized snapshot of the acting
 * user at the time of the action (not just a `userId` FK) so a log entry
 * stays meaningful even if that `User` account is later deleted.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  await prisma.activityLog.create({
    data: {
      userId: input.userId ?? null,
      userEmail: input.userEmail ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
    },
  });
}

/** Most recent activity first, for the OWNER-only Settings tab. */
export async function getRecentActivity(limit = 100): Promise<ActivityLog[]> {
  return prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
