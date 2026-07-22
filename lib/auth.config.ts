import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe slice of the NextAuth config: no providers that touch Prisma
 * (Prisma's generated client pulls in Node built-ins — `node:path`,
 * `node:url` — which the Edge runtime `middleware.ts` runs under can't
 * load). `lib/auth.ts` spreads this and adds the real Credentials
 * provider for the Node-runtime API route; `middleware.ts` builds its own
 * lightweight `NextAuth(authConfig)` instance from just this file so route
 * protection never bundles Prisma. Session verification under the JWT
 * strategy only needs to check/decode the signed cookie, not hit the DB,
 * so this split doesn't lose any middleware functionality.
 */
export const authConfig: NextAuthConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
