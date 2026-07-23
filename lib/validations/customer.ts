import { z } from "zod";

/**
 * Matches the Prisma `Gender` enum exactly (see prisma/schema.prisma).
 * Duplicated here (rather than importing the Prisma enum) so this file
 * stays usable from client components without pulling in the generated
 * Prisma client bundle.
 */
export const genderEnum = z.enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]);

/** Basic Indian mobile number: exactly 10 digits, first digit 6-9. */
const mobileNumberSchema = z
  .string()
  .min(1, "Mobile number is required")
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

/**
 * Optional date field coming from an `<input type="date">` (a "YYYY-MM-DD"
 * string, or empty string for "not set"). Coerced to `Date | undefined` so
 * callers (API routes) can hand it straight to Prisma.
 */
const optionalDateSchema = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((val) => {
    if (!val || val === "") return undefined;
    const date = typeof val === "string" ? new Date(val) : val;
    return Number.isNaN(date.getTime()) ? undefined : date;
  });

/** Full schema for creating a customer. */
export const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  mobileNumber: mobileNumberSchema,
  birthday: optionalDateSchema,
  anniversary: optionalDateSchema,
  areaLocality: z.string().optional().nullable(),
  gender: genderEnum.optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

/** Partial variant for PATCH/update — every field optional, but any field
 * present is still validated against the same rules. */
export const customerUpdateSchema = customerSchema.partial();

export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

/** Compact schema for QuickAddSheet — just the two required fields. */
export const quickAddCustomerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  mobileNumber: mobileNumberSchema,
});

export type QuickAddCustomerInput = z.infer<typeof quickAddCustomerSchema>;
