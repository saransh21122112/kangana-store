import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { authConfig } from "@/lib/auth.config";

/**
 * NextAuth v5 (`next-auth@5.0.0-beta.32`) config. v5 replaces the old
 * `NextApiHandler`-based setup with a single `NextAuth(config)` call that
 * returns `{ handlers, auth, signIn, signOut }` — `handlers.GET`/`handlers.POST`
 * are wired into the App Router route below, `auth()` is the new universal
 * session getter (usable in Server Components, route handlers, and
 * middleware), and `signIn`/`signOut` are server-side actions (the client
 * form uses the `next-auth/react` versions instead, see app/login/page.tsx).
 *
 * The base session/callback config lives in `lib/auth.config.ts` and is
 * spread in here — this file adds the Credentials provider (which needs
 * Prisma, i.e. must run in the Node runtime, not Edge) on top. See that
 * file's doc comment for why the split exists.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return null;
        }

        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
