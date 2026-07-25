import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { billReturnSchema } from "@/lib/validations/bill-return";
import { createReturn } from "@/lib/queries/bill-returns";
import { getBillById } from "@/lib/queries/bills";
import { logActivity } from "@/lib/queries/activity-log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Records a return against one of this bill's line items. `[id]` is the
 * bill, but `createReturn` operates on a `lineItemId` from the body — this
 * route checks that line item actually belongs to the bill in the URL
 * before touching it, so a client can't record a return against an
 * unrelated bill's line item by guessing/tampering with the id.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const bill = await getBillById(id);
  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = billReturnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const belongsToBill = bill.lineItems.some((li) => li.id === parsed.data.lineItemId);
  if (!belongsToBill) {
    return NextResponse.json({ error: "Line item does not belong to this bill" }, { status: 400 });
  }

  const result = await createReturn(parsed.data, guard.session.user.id);

  if (!result.ok) {
    if (result.reason === "line_item_not_found") {
      return NextResponse.json({ error: "Line item not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: `Only ${result.availableQuantity} unit(s) available to return on this item`,
        reason: result.reason,
        availableQuantity: result.availableQuantity,
      },
      { status: 409 }
    );
  }

  await logActivity({
    userId: guard.session.user.id,
    userEmail: guard.session.user.email,
    action: "bill.return",
    entityType: "Bill",
    entityId: id,
    summary: `Recorded return of ${result.billReturn.quantityReturned} unit(s) (₹${result.billReturn.amountReturned.toLocaleString("en-IN")}) on bill ${bill.billNo}`,
  });

  return NextResponse.json({ billReturn: result.billReturn, customer: result.customer });
}
