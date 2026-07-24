import { z } from "zod";

/** Non-negative integer, accepting a string (as produced by a plain
 * `<input type="number">` via `register`) or a number — mirrors
 * `lib/validations/bill.ts`'s `amountSchema` string-or-number pattern so the
 * form's `z.input` type stays a plain `string`, not `unknown`. */
const nonNegativeIntSchema = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    const num = typeof val === "string" ? Number(val) : val;
    if (Number.isNaN(num) || !Number.isInteger(num) || num < 0) {
      ctx.addIssue({ code: "custom", message: "Must be a whole number, 0 or greater" });
      return z.NEVER;
    }
    return num;
  });

/** Full schema for creating an inventory item. */
export const inventoryItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  quantity: nonNegativeIntSchema,
  lowStockThreshold: nonNegativeIntSchema,
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

/**
 * Partial variant for PATCH/update — name/category/lowStockThreshold only.
 * `quantity` is deliberately excluded here: stock changes go through the
 * separate delta-based `stockAdjustSchema`/`/adjust` endpoint instead, so
 * editing an item's details can never accidentally overwrite its quantity.
 */
export const inventoryItemUpdateSchema = inventoryItemSchema
  .omit({ quantity: true })
  .partial();

export type InventoryItemUpdateInput = z.infer<typeof inventoryItemUpdateSchema>;

/** Delta-based stock adjustment — positive to add stock, negative to remove. */
export const stockAdjustSchema = z.object({
  delta: z.number().int(),
});

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
