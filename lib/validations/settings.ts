import { z } from "zod";

/**
 * Store profile: name, optional logo URL, accent color (hex).
 *
 * `logoUrl` accepts `null` on input (not just `""`/`undefined`) as well as
 * transforming to `null` on output — this schema is used on both sides of
 * the round trip: `StoreProfileForm` parses raw form input through it via
 * `zodResolver` (producing the transformed `string | null` in its
 * `onSubmit` payload), and `PATCH /api/settings/store` parses that already-
 * transformed request body through the *same* schema again. Without also
 * accepting `null` as valid input, a save with a blank Logo URL field would
 * 400 on the server every time (caught during Stage 9's final end-to-end
 * verification pass — not previously exercised).
 */
export const storeProfileSchema = z.object({
  storeName: z.string().min(1, "Store name is required").max(120),
  logoUrl: z
    .union([z.string().url("Enter a valid URL"), z.literal(""), z.null()])
    .optional()
    .transform((val) => (val === "" || val === undefined || val === null ? null : val)),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Enter a valid hex color, e.g. #0A84FF"),
});

export type StoreProfileInput = z.infer<typeof storeProfileSchema>;

/** Bill category list — a non-empty array of unique, non-blank strings. */
export const categoriesSchema = z.object({
  categories: z
    .array(z.string().trim().min(1, "Category name can't be blank"))
    .min(1, "At least one category is required")
    .refine((cats) => new Set(cats.map((c) => c.toLowerCase())).size === cats.length, {
      message: "Category names must be unique",
    }),
});

export type CategoriesInput = z.infer<typeof categoriesSchema>;

/** Inactive-customer thresholds, informational/soft-linked — see MEMORY.md. */
export const thresholdsSchema = z.object({
  inactiveThreshold30: z.coerce.number().int().positive(),
  inactiveThreshold60: z.coerce.number().int().positive(),
  inactiveThreshold90: z.coerce.number().int().positive(),
});

export type ThresholdsInput = z.infer<typeof thresholdsSchema>;

/**
 * Create-user form (Settings → Users → Add User).
 *
 * `email` is lowercased on input — `User.email`'s Postgres unique index is
 * case-sensitive by default (no citext column), so without normalizing here
 * a case-variant of an existing email (e.g. `Owner@kangnabeauty.in` vs
 * `owner@kangnabeauty.in`) would sail past the app's own pre-check
 * (`findUnique({where:{email}}))` in `app/api/settings/users/route.ts`,
 * which is also an exact-case lookup) and insert as a second, confusingly
 * separate account. Chosen as an application-level fix (normalize before
 * store/query) rather than a schema-level `citext` column change, per this
 * stage's own constraint to prefer that when possible.
 */
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .transform((v) => v.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["OWNER", "STAFF"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Update-user form: role change and/or password reset. At least one field. */
export const updateUserSchema = z
  .object({
    userId: z.string().min(1),
    role: z.enum(["OWNER", "STAFF"]).optional(),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
  })
  .refine((data) => data.role !== undefined || data.password !== undefined, {
    message: "Provide a role or password to update",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
