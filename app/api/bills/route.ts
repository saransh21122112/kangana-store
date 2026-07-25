import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { billSchema } from "@/lib/validations/bill";
import { createBillWithRollup } from "@/lib/queries/bills";
import { logActivity } from "@/lib/queries/activity-log";

export async function POST(req: Request) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = billSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const result = await createBillWithRollup(parsed.data);

  if (!result.ok) {
    if (result.reason === "duplicate_billNo") {
      return NextResponse.json(
        { error: "A bill with this bill number already exists", reason: result.reason },
        { status: 409 }
      );
    }
    if (result.reason === "insufficient_stock") {
      return NextResponse.json(
        { error: "Not enough stock for this item", reason: result.reason },
        { status: 409 }
      );
    }
    if (result.reason === "inventory_item_not_found") {
      return NextResponse.json(
        { error: "Inventory item not found", reason: result.reason },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Customer not found", reason: result.reason },
      { status: 404 }
    );
  }

  await logActivity({
    userId: guard.session.user.id,
    userEmail: guard.session.user.email,
    action: "bill.create",
    entityType: "Bill",
    entityId: result.bill.id,
    summary: `Created bill ${result.bill.billNo} for ${result.customer.name} (₹${result.bill.amount.toLocaleString("en-IN")})`,
  });

  return NextResponse.json({ bill: result.bill, customer: result.customer }, { status: 201 });
}
