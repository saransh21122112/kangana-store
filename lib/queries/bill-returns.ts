import { prisma } from "@/lib/prisma";
import type { BillReturn, Customer } from "@/lib/generated/prisma/client";
import type { BillReturnInput } from "@/lib/validations/bill-return";
import { getLoyaltyPointsPerRupee, recalculateCustomerRollup, TRANSACTION_OPTIONS } from "@/lib/queries/bills";

export type CreateReturnResult =
  | { ok: true; billReturn: BillReturn; customer: Customer }
  | { ok: false; reason: "line_item_not_found" }
  | { ok: false; reason: "exceeds_available_quantity"; availableQuantity: number };

/**
 * Records a partial (or full) return against a single `BillLineItem`.
 * `amountReturned` is always computed pro-rata here from the line item's own
 * `lineTotal`/`quantity` (never trusted from the client) — returning half
 * the quantity refunds exactly half the line's value, rounded to 2 decimals.
 *
 * "Available to return" is the line's original `quantity` minus whatever's
 * already been returned against it across all prior `BillReturn` rows for
 * that same line item — multiple partial returns on one line item are
 * allowed as long as their quantities never sum past the original.
 *
 * On success: creates the `BillReturn` row, restores stock on the linked
 * `InventoryItem` (if any) by `quantityReturned`, claws back loyalty points
 * proportional to `amountReturned` at the CURRENT `loyaltyPointsPerRupee`
 * rate (same accepted simplification as `deleteBill`'s clawback — the rate
 * in effect at earn time isn't stored), clamped at 0, then recalculates the
 * owning customer's rollup (which nets out returns — see
 * `recalculateCustomerRollup`).
 */
export async function createReturn(
  data: BillReturnInput,
  createdById: string | null
): Promise<CreateReturnResult> {
  return prisma.$transaction(async (tx) => {
    const lineItem = await tx.billLineItem.findUnique({
      where: { id: data.lineItemId },
      include: { bill: true, returns: true },
    });
    if (!lineItem) {
      return { ok: false, reason: "line_item_not_found" };
    }

    const alreadyReturned = lineItem.returns.reduce((sum, r) => sum + r.quantityReturned, 0);
    const availableQuantity = lineItem.quantity - alreadyReturned;
    if (data.quantityReturned > availableQuantity) {
      return { ok: false, reason: "exceeds_available_quantity", availableQuantity };
    }

    const amountReturned =
      Math.round((lineItem.lineTotal / lineItem.quantity) * data.quantityReturned * 100) / 100;

    const billReturn = await tx.billReturn.create({
      data: {
        lineItemId: lineItem.id,
        quantityReturned: data.quantityReturned,
        amountReturned,
        reason: data.reason,
        createdById,
      },
    });

    if (lineItem.inventoryItemId) {
      await tx.inventoryItem.update({
        where: { id: lineItem.inventoryItemId },
        data: { quantity: { increment: data.quantityReturned } },
      });
    }

    const loyaltyPointsPerRupee = await getLoyaltyPointsPerRupee(tx);
    const pointsToClawBack = Math.floor(amountReturned * loyaltyPointsPerRupee);
    if (pointsToClawBack !== 0) {
      const customer = await tx.customer.findUnique({
        where: { id: lineItem.bill.customerId },
        select: { loyaltyPoints: true },
      });
      if (customer) {
        await tx.customer.update({
          where: { id: lineItem.bill.customerId },
          data: { loyaltyPoints: Math.max(0, customer.loyaltyPoints - pointsToClawBack) },
        });
      }
    }

    const customer = await recalculateCustomerRollup(lineItem.bill.customerId, tx);

    return { ok: true, billReturn, customer };
  }, TRANSACTION_OPTIONS);
}

/** All returns recorded against a given bill's line items, most recent first — for display on the bill/customer views. */
export async function getReturnsForBill(billId: string): Promise<BillReturn[]> {
  return prisma.billReturn.findMany({
    where: { lineItem: { billId } },
    orderBy: { createdAt: "desc" },
  });
}
