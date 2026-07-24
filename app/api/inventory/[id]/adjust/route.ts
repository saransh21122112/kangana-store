import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { stockAdjustSchema } from "@/lib/validations/inventory";
import { adjustStock } from "@/lib/queries/inventory";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Dedicated delta-based stock adjustment endpoint, kept separate from the
 * `PATCH /api/inventory/[id]` item-details update so quantity changes stay
 * auditable/intentional (+1/-1 or a custom amount) rather than editable as a
 * raw field alongside name/category/lowStockThreshold.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = stockAdjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const result = await adjustStock(id, parsed.data.delta);

  if (!result.ok) {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }

  return NextResponse.json({ item: result.item });
}
