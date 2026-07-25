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
 * Quantity as a required positive integer, defaulting to 1. Accepts a
 * string (as produced by a plain `<input type="number">` via `register`) or
 * a number, mirroring the string-or-number transform pattern already used
 * elsewhere in this file.
 */
const quantitySchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val, ctx) => {
    if (val === undefined || val === "") return 1;
    const num = typeof val === "string" ? Number(val) : val;
    if (Number.isNaN(num) || !Number.isInteger(num) || num <= 0) {
      ctx.addIssue({ code: "custom", message: "Quantity must be a positive whole number" });
      return z.NEVER;
    }
    return num;
  });

/**
 * Optional positive-number field shared by `unitPrice`/`lineTotal` — accepts
 * a string or number, mirroring the string-or-number transform pattern
 * already used elsewhere in this file.
 */
function optionalPositiveNumberSchema(message: string) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((val, ctx) => {
      if (val === undefined || val === "") return undefined;
      const num = typeof val === "string" ? Number(val) : val;
      if (Number.isNaN(num) || num <= 0) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return num;
    });
}

const unitPriceSchema = optionalPositiveNumberSchema("Unit price must be greater than 0");
const lineTotalSchema = optionalPositiveNumberSchema("Line total must be greater than 0");

/**
 * A single purchased line item on a bill's "shopping cart". Exactly one of
 * `unitPrice`/`lineTotal` must be provided — the staff member's choice of
 * entering a per-item cost (which gets multiplied out) or a total cost for
 * the line directly. After parsing, `lineTotal` is guaranteed to be a
 * concrete number (computed from `unitPrice * quantity`, rounded to 2
 * decimals, when only `unitPrice` was given) so every downstream consumer
 * can just read `lineItem.lineTotal` without re-deriving it.
 */
const lineItemInputSchema = z
  .object({
    category: z.string().min(1, "Category is required"),
    inventoryItemId: z.string().optional(),
    quantity: quantitySchema,
    unitPrice: unitPriceSchema,
    lineTotal: lineTotalSchema,
  })
  .superRefine((data, ctx) => {
    const hasUnitPrice = data.unitPrice !== undefined;
    const hasLineTotal = data.lineTotal !== undefined;
    if (hasUnitPrice === hasLineTotal) {
      ctx.addIssue({
        code: "custom",
        message: "Provide exactly one of unit price or line total",
        path: ["lineTotal"],
      });
    }
  })
  .transform((data) => {
    const lineTotal =
      data.lineTotal !== undefined
        ? data.lineTotal
        : Math.round((data.unitPrice ?? 0) * data.quantity * 100) / 100;
    return { ...data, lineTotal };
  });

export type LineItemInput = z.infer<typeof lineItemInputSchema>;

/** Full schema for creating a bill — a `lineItems` "shopping cart" replaces
 * the old flat single category/amount/inventoryItemId/quantitySold shape.
 * `amount` is no longer supplied by the client at all; it's always derived
 * server-side as the sum of the line items' `lineTotal`s. */
export const billSchema = z.object({
  billNo: z.string().min(1, "Bill number is required"),
  date: requiredDateSchema,
  customerId: z.string().min(1, "Customer is required"),
  lineItems: z.array(lineItemInputSchema).min(1, "At least one item is required"),
});

export type BillInput = z.infer<typeof billSchema>;

/**
 * Partial variant for PATCH/update. Deliberately its OWN object (not
 * `billSchema.partial()`) — editing a bill's line items after creation is
 * explicitly out of scope (same prior decision that `updateBill` doesn't
 * touch the inventory link after creation), so `lineItems` must not appear
 * here at all, not even as an optional field.
 */
export const billUpdateSchema = z
  .object({
    billNo: z.string().min(1, "Bill number is required"),
    date: requiredDateSchema,
    customerId: z.string().min(1, "Customer is required"),
  })
  .partial();

export type BillUpdateInput = z.infer<typeof billUpdateSchema>;
