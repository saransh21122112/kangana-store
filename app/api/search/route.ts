import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/requireRole";
import { searchCustomers } from "@/lib/queries/search";

/**
 * GET /api/search?q=...
 * Backs the global command palette (Cmd/Ctrl-K). Debouncing is a client
 * concern (see components/search/CommandPalette.tsx) — this route just
 * answers whatever query it's given, capped at searchCustomers's default
 * limit.
 */
export async function GET(req: Request) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchCustomers(q);
  return NextResponse.json({ results });
}
