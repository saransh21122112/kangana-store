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

/** Non-negative number (price), same string-or-number acceptance as above. */
const nonNegativeNumberSchema = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    const num = typeof val === "string" ? Number(val) : val;
    if (Number.isNaN(num) || num < 0) {
      ctx.addIssue({ code: "custom", message: "Must be 0 or greater" });
      return z.NEVER;
    }
    return num;
  });

export const UNIT_TYPE_OPTIONS = ["Pcs", "Box", "Dozen", "PKT", "Set"] as const;

/** Full schema for creating an inventory item. */
export const inventoryItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  brand: z.string().trim().optional(),
  unitType: z.string().min(1, "Unit is required").default("Pcs"),
  ratePerUnit: nonNegativeNumberSchema.default(0),
  quantity: nonNegativeIntSchema,
  lowStockThreshold: nonNegativeIntSchema,
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

/**
 * Partial variant for PATCH/update — name/category/brand/unitType/
 * ratePerUnit/lowStockThreshold only. `quantity` is deliberately excluded
 * here: stock changes go through the separate delta-based
 * `stockAdjustSchema`/`/adjust` endpoint instead, so editing an item's
 * details can never accidentally overwrite its quantity.
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

/**
 * One row of the CSV bulk-price-import round-trip (see
 * `app/api/inventory/import/route.ts`). Only `id` plus the three
 * spreadsheet-editable fields are accepted — `name`/`category`/`brand`
 * columns may be present in the uploaded file (the export includes them for
 * the owner's reference while editing in Excel) but are deliberately not
 * part of this schema, so the import can never overwrite them even if the
 * sheet's other columns were hand-edited.
 */
export const inventoryImportRowSchema = z.object({
  id: z.string().min(1, "Missing id"),
  ratePerUnit: nonNegativeNumberSchema,
  quantity: nonNegativeIntSchema,
  lowStockThreshold: nonNegativeIntSchema,
});

export type InventoryImportRowInput = z.infer<typeof inventoryImportRowSchema>;

/** Bulk recategorize from the Inventory table's multi-select bar — every
 * selected id moves to the same new `category`. */
export const bulkRecategorizeSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one item"),
  category: z.string().min(1, "Category is required"),
});

export type BulkRecategorizeInput = z.infer<typeof bulkRecategorizeSchema>;
