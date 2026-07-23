import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import type { AppRole } from "@/types/next-auth";
import type { Session } from "next-auth";

export type RequireRoleResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

/**
 * Server-side guard for use at the top of App Router route handlers, e.g.:
 *
 * ```ts
 * export async function POST(req: Request) {
 *   const guard = await requireRole("OWNER");
 *   if (!guard.ok) return guard.response;
 *   const { session } = guard;
 *   // ...
 * }
 * ```
 *
 * Deliberately *returns* a `NextResponse` on failure rather than throwing.
 * Route handlers already return `Response`/`NextResponse`, so an early
 * `if (!guard.ok) return guard.response` reads naturally and keeps the
 * 401/403 status codes explicit — a thrown error would need every caller to
 * wrap the handler in try/catch (or rely on Next's generic 500 error
 * boundary) to recover the right status code, which is worse ergonomics for
 * the common case.
 */
export async function requireRole(
  role: AppRole | AppRole[]
): Promise<RequireRoleResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const allowedRoles = Array.isArray(role) ? role : [role];
  if (!allowedRoles.includes(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, session };
}
