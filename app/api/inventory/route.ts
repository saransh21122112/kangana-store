import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { inventoryItemSchema } from "@/lib/validations/inventory";
import { createInventoryItem, getAllInventoryItems } from "@/lib/queries/inventory";

export async function GET(req: Request) {
  const guard = await requireRole(["OWNER", "STAFF", "VIEWER"]);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const lowStockOnly = searchParams.get("lowStockOnly") === "true";

  const items = await getAllInventoryItems({ category, lowStockOnly });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = inventoryItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const item = await createInventoryItem(parsed.data);

  return NextResponse.json({ item }, { status: 201 });
}
