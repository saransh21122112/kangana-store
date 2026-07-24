import { z } from "zod";

/**
 * Starter fixed category list. A Settings-driven configurable list is
 * spec'd for a later stage — hardcoding this now keeps the category
 * `<select>` usable without over-building a settings system prematurely.
 * Exported so `AddBillForm`'s `<select>` and any other bill UI can share
 * the exact same list rather than re-declaring it.
 */
export const BILL_CATEGORIES = [
  "Jewellery - Gold",
  "Jewellery - Diamond",
  "Jewellery - Silver",
  "Beauty Services",
  "Skincare",
  "Makeup",
  "Other",
] as const;

/**
 * Required date field coming from an `<input type="date">` (a "YYYY-MM-DD"
 * string) or a `Date`. Unlike customer.ts's `optionalDateSchema`, this one
 * is required — a bill must have a date.
 */
const requiredDateSchema = z
  .union([z.string(), z.date()])
  .transform((val, ctx) => {
    const date = typeof val === "string" ? new Date(val) : val;
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date" });
      return z.NEVER;
    }
    return date;
  });

/**
 * Amount as a required positive number. Accepts a string (as produced by a
 * plain `<input type="number">` via `register`) or a number, and transforms
 * to `number` — mirrors `requiredDateSchema`'s string-or-native-type
 * pattern so the form's `z.input` type stays a plain `string`, not
 * `unknown` (which `z.coerce.number()`'s input type would otherwise be).
 */
const amountSchema = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    const num = typeof val === "string" ? Number(val) : val;
    if (Number.isNaN(num) || num <= 0) {
      ctx.addIssue({ code: "custom", message: "Amount must be greater than 0" });
      return z.NEVER;
    }
    return num;
  });

/**
 * Quantity sold as an optional positive integer. Accepts a string (as
 * produced by a plain `<input type="number">` via `register`) or a number,
 * mirroring `amountSchema`'s string-or-number transform pattern — but
 * optional, since most bills don't link an inventory item at all.
 */
const quantitySoldSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val, ctx) => {
    if (val === undefined || val === "") return undefined;
    const num = typeof val === "string" ? Number(val) : val;
    if (Number.isNaN(num) || !Number.isInteger(num) || num <= 0) {
      ctx.addIssue({ code: "custom", message: "Quantity sold must be a positive whole number" });
      return z.NEVER;
    }
    return num;
  });

/**
 * Base object shape shared by `billSchema` and `billUpdateSchema` — kept as
 * a plain `z.object` (not wrapped in `.superRefine()` yet) so `.partial()`
 * remains available for the update variant, matching the pre-existing
 * `billUpdateSchema = billSchema.partial()` pattern.
 */
const billObjectSchema = z.object({
  billNo: z.string().min(1, "Bill number is required"),
  date: requiredDateSchema,
  amount: amountSchema,
  category: z.string().min(1, "Category is required"),
  customerId: z.string().min(1, "Customer is required"),
  /** Optional link to a stocked InventoryItem — most bills won't set this
   * (e.g. "Beauty Services" has no stocked items). When set, `quantitySold`
   * must also be set, and vice versa (both-or-neither). */
  inventoryItemId: z.string().optional(),
  quantitySold: quantitySoldSchema,
});

/** Shared both-or-neither check for `inventoryItemId`/`quantitySold`. */
function refineInventoryLink(
  data: { inventoryItemId?: string; quantitySold?: number },
  ctx: z.RefinementCtx
) {
  const hasItem = data.inventoryItemId !== undefined && data.inventoryItemId !== "";
  const hasQuantity = data.quantitySold !== undefined;
  if (hasItem && !hasQuantity) {
    ctx.addIssue({
      code: "custom",
      message: "Quantity sold is required when linking an inventory item",
      path: ["quantitySold"],
    });
  }
  if (hasQuantity && !hasItem) {
    ctx.addIssue({
      code: "custom",
      message: "An inventory item must be selected when quantity sold is set",
      path: ["inventoryItemId"],
    });
  }
}

/** Full schema for creating/updating a bill. */
export const billSchema = billObjectSchema.superRefine(refineInventoryLink);

export type BillInput = z.infer<typeof billSchema>;

/** Partial variant for PATCH/update — every field optional, but any field
 * present is still validated against the same rules. Built from the same
 * both-or-neither refinement as `billSchema` (not just `.partial()` alone),
 * so a PATCH that sets only one of the pair is still rejected. */
export const billUpdateSchema = billObjectSchema.partial().superRefine(refineInventoryLink);

export type BillUpdateInput = z.infer<typeof billUpdateSchema>;
