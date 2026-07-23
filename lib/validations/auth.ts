import { z } from "zod";

export const loginSchema = z.object({
  // Lowercased on input — `User.email`'s Postgres unique index is
  // case-sensitive by default (no citext column), and every email is now
  // stored lowercase (see `createUserSchema` in `lib/validations/settings.ts`
  // and the seed data), so normalizing here too makes login itself
  // case-insensitive rather than only matching whatever case the account
  // happened to be created with.
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
