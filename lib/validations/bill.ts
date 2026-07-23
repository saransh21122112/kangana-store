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

/** Full schema for creating/updating a bill. */
export const billSchema = z.object({
  billNo: z.string().min(1, "Bill number is required"),
  date: requiredDateSchema,
  amount: amountSchema,
  category: z.string().min(1, "Category is required"),
  customerId: z.string().min(1, "Customer is required"),
});

export type BillInput = z.infer<typeof billSchema>;

/** Partial variant for PATCH/update — every field optional, but any field
 * present is still validated against the same rules. */
export const billUpdateSchema = billSchema.partial();

export type BillUpdateInput = z.infer<typeof billUpdateSchema>;
