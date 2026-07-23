import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";

const PUBLIC_PATHS = ["/login"];

// Middleware runs on the Edge runtime and must not import lib/auth.ts
// directly - that file's Credentials provider imports Prisma's generated
// client, which loads Node built-ins (node:path, node:url) that Edge
// can't bundle. Building a separate, edge-safe NextAuth instance from just
// authConfig (no providers) keeps this file Prisma-free while still
// getting a real auth() that can verify the JWT session cookie.
const { auth } = NextAuth(authConfig);

/**
 * NextAuth v5's `auth` export doubles as a middleware wrapper: calling it
 * with a callback gives that callback a `NextAuthRequest` (a `NextRequest`
 * with an extra `.auth` session field already resolved), and whatever the
 * callback returns becomes the middleware's response. This is the
 * recommended v5 replacement for the old `withAuth` v4 middleware helper.
 *
 * This only decides "logged in or not" - per-role (OWNER-only) gating is
 * handled per-route via `lib/auth/requireRole.ts`, not here.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!isLoggedIn && !isPublicPath) {
    // API routes should fail with a JSON 401, not a 307 HTML redirect to
    // /login - a `fetch()`/`curl` caller with no session cookie expects a
    // machine-readable auth failure, not to silently receive the login
    // page's HTML (which is what following the redirect would produce).
    // Page routes keep the redirect-to-/login UX.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublicPath) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Protect everything except NextAuth's own API routes, Next.js
  // internals/static assets, and Stage 8's cron endpoint. `/login` itself
  // is matched (so the logged-in-and-on-/login redirect above still runs)
  // but excluded from the "must be authenticated" check via PUBLIC_PATHS.
  //
  // `icon.jpg` (and `apple-icon.*`, in case one's added later) is Next's
  // file-convention favicon — it replaced the old `favicon.ico` when the
  // real Kangna logo was added, and needs the same public-asset exclusion
  // that file had, or unauthenticated requests for it (e.g. the browser
  // tab icon on /login itself) get redirected to /login instead of the
  // image, breaking the favicon everywhere a session cookie isn't set yet.
  //
  // `api/cron` is excluded here because it has no user session to check —
  // Vercel Cron (and the manual curl verification in Stage 8) hits it with
  // an `Authorization: Bearer <CRON_SECRET>` header instead, checked
  // directly inside app/api/cron/daily-check/route.ts. Without this
  // exclusion, this middleware would redirect the cron request to /login
  // (a 307, not the intended 401) before the route handler ever runs.
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|icon.jpg|apple-icon.jpg).*)"],
};
