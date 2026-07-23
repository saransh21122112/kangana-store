"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Thin client-component wrapper around next-auth/react's SessionProvider,
 * mounted once in the root layout so any client component further down the
 * tree (login form, a future user-menu in the Sidebar, etc.) can call
 * useSession()/signIn()/signOut().
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
