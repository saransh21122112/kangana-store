import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { loyaltyAdjustSchema } from "@/lib/validations/customer";
import { adjustLoyaltyPoints } from "@/lib/queries/customers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Manual loyalty-point adjustment endpoint (Stage 21) — mirrors
 * `POST /api/inventory/[id]/adjust` exactly. Kept separate from the
 * customer-details `PATCH` so point changes stay their own explicit action,
 * not a raw field editable alongside name/mobile/etc.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = loyaltyAdjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const result = await adjustLoyaltyPoints(id, parsed.data.delta);

  if (!result.ok) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ customer: result.customer });
}
