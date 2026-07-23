import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { getAllNotifications, markAllRead, markOneRead } from "@/lib/queries/notifications";

/** GET /api/notifications — recent notifications (most recent first), for the NotificationBell. */
export async function GET() {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const notifications = await getAllNotifications();
  return NextResponse.json({ notifications });
}

const patchSchema = z.union([
  z.object({ id: z.string().min(1) }),
  z.object({ all: z.literal(true) }),
]);

/**
 * PATCH /api/notifications — mark-read. Body is either `{ id }` (mark one)
 * or `{ all: true }` (mark all unread as read).
 */
export async function PATCH(req: Request) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  if ("all" in parsed.data) {
    const count = await markAllRead();
    return NextResponse.json({ ok: true, count });
  }

  const notification = await markOneRead(parsed.data.id);
  return NextResponse.json({ ok: true, notification });
}
