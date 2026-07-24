import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { inventoryItemUpdateSchema } from "@/lib/validations/inventory";
import {
  deleteInventoryItem,
  getInventoryItemById,
  updateInventoryItem,
} from "@/lib/queries/inventory";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF", "VIEWER"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const item = await getInventoryItemById(id);

  if (!item) {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = inventoryItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const result = await updateInventoryItem(id, parsed.data);

  if (!result.ok) {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }

  return NextResponse.json({ item: result.item });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const result = await deleteInventoryItem(id);

  if (!result.ok) {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
