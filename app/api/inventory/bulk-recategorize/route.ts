import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { bulkRecategorizeSchema } from "@/lib/validations/inventory";
import { bulkUpdateCategory } from "@/lib/queries/inventory";

/**
 * Bulk recategorize for the Inventory table's multi-select bar — moves every
 * selected item to one new `category` via a single `updateMany`. Same
 * OWNER+STAFF gate as `POST /api/inventory`.
 */
export async function POST(req: Request) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = bulkRecategorizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const result = await bulkUpdateCategory(parsed.data.ids, parsed.data.category);

  return NextResponse.json({ updated: result.count });
}
