import { z } from "zod";

/**
 * Quantity being returned, as a required positive integer. Accepts a
 * string (as produced by a plain `<input type="number">` via `register`) or
 * a number, mirroring the string-or-number transform pattern used throughout
 * `lib/validations/bill.ts`. Whether this is within what's actually still
 * returnable on the target line item (quantity minus prior returns) is a
 * data-dependent check the schema can't see — enforced by
 * `lib/queries/bill-returns.ts`'s `createReturn`, not here.
 */
const quantityReturnedSchema = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    const num = typeof val === "string" ? Number(val) : val;
    if (Number.isNaN(num) || !Number.isInteger(num) || num <= 0) {
      ctx.addIssue({ code: "custom", message: "Quantity must be a positive whole number" });
      return z.NEVER;
    }
    return num;
  });

/**
 * A return against a single `BillLineItem`. `amountReturned` is
 * deliberately NOT part of this input — it's always computed server-side
 * pro-rata from the line item's own `lineTotal`/`quantity` (see
 * `createReturn`), so a partial return of half the quantity always refunds
 * exactly half the line's value rather than trusting a client-supplied
 * figure that could drift from the original sale price.
 */
export const billReturnSchema = z.object({
  lineItemId: z.string().min(1, "Line item is required"),
  quantityReturned: quantityReturnedSchema,
  reason: z.string().optional(),
});

export type BillReturnInput = z.infer<typeof billReturnSchema>;
