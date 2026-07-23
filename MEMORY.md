# Kangna Beauty & Jewellery CRM — Build Log

A running log of what was built, in what order, and why — written so this project can be
rebuilt from scratch by someone else following the same prompts and decisions.

---

## Stage 0 — Scaffolding & Postgres Provisioning

**Prompt/request:** Build the full CRM per the locked-in spec (Next.js 14+/TS, Tailwind+shadcn,
Prisma/Postgres, NextAuth, WhatsApp link-mode, Apple-HIG design system), provisioning Postgres via
Vercel Marketplace rather than local Docker, in auto mode with subagents doing the implementation
work.

**What was built:**
- Scaffolded Next.js (App Router, TypeScript strict, Tailwind, ESLint, Turbopack) via
  `create-next-app`. Had to scaffold into a temp directory first and `rsync` the files in, because
  `create-next-app` refuses to target a directory whose name (the project's actual folder,
  `kangana store ` — trailing space) fails npm package-name validation. Fixed `package.json`'s
  `name` to `kangana-crm` after copying in.
- Installed the full dependency set from the spec: `@prisma/client`, `next-auth@beta`, `bcryptjs`,
  `zod`, `react-hook-form` + `@hookform/resolvers`, `@tanstack/react-query`, `recharts`,
  `framer-motion`, `lucide-react`, `next-themes`, `date-fns`; dev deps `prisma`, `@types/bcryptjs`,
  `tsx`.
- Initialized shadcn/ui (`npx shadcn init -d`), which detected Tailwind v4 and wrote
  `components.json` + `lib/utils.ts` + a starter `button.tsx`.
- Ran `npx prisma init --datasource-provider postgresql`. **Note:** this project landed on
  **Prisma 7**, which changed how datasource URLs work — `url`/`directUrl` are no longer allowed
  inside `schema.prisma`'s `datasource` block at all; they must live in `prisma.config.ts`, and
  `PrismaClient` now requires a driver **adapter** rather than reading a connection string
  directly. This is a real deviation from how the original spec (written for older Prisma)
  expected the datasource block to look — worth knowing if resuming this project later and prior
  knowledge assumes `url = env("DATABASE_URL")` works in schema.prisma (it does not, in v7).
- Installed `pg` + `@prisma/adapter-pg` (+ `@types/pg`) to satisfy the Prisma 7 adapter
  requirement; `lib/prisma.ts` (built in Stage 2) will construct `PrismaClient` with a `pg` Pool
  adapter using the pooled `DATABASE_URL`.
- Installed the Vercel CLI (`npm i -g vercel`), logged in (device-flow auth completed
  automatically), and ran `vercel link --project kangana-crm` — had to pass `--project` explicitly
  since the directory name (trailing space) isn't a valid Vercel project name either.
- Provisioned Postgres via the Vercel Marketplace: `vercel integration add neon` (chose Neon over
  Supabase — no strong requirement either way, Neon's Prisma integration guide was the more
  direct/serverless-driver-friendly fit). This connected the Neon Postgres resource to the
  `kangana-crm` Vercel project and pulled all connection env vars into `.env.local`.
- Wrote `.env` (Prisma CLI loads `.env`, not `.env.local`, via `prisma.config.ts`'s
  `import "dotenv/config"`) with: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (copied from
  `.env.local`), a freshly generated `NEXTAUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3000`,
  `WHATSAPP_MODE=link` (+ empty Cloud API placeholders), and a generated `CRON_SECRET`.
- Configured `prisma.config.ts`'s `datasource.url` to point at `DATABASE_URL_UNPOOLED` (Neon's
  guidance: use the direct/non-pooled connection for Migrate, since the pooled PgBouncer-style
  connection can misbehave with schema-changing transactions). The pooled `DATABASE_URL` is
  reserved for the runtime Prisma Client adapter instead.

**Why:**
- Vercel Marketplace provisioning (over local Docker) was an explicit user choice, to keep local
  dev pointed at the same DB that'll be used in deployment.
- The temp-dir-then-rsync scaffolding workaround and the `--project`/`package.json` name fixes were
  both necessitated by the trailing space in the project folder name, which the user confirmed is
  intentional — so the workaround, not renaming the folder, was the right fix.
- The Prisma 7 driver-adapter requirement was discovered by trial and error (schema validation
  errors), not anticipated in the original spec — documented here so it isn't re-discovered painfully
  later, and so `lib/prisma.ts` in Stage 2 is written adapter-first from the start.

**Verification:** `npx prisma db pull --print` connects successfully to the live Neon database (it
reports the DB is empty, which is expected — no tables/migrations yet).

**Next:** Stage 1 — design system & app shell.

---

## Stage 1 — Design System & App Shell

**Prompt/request:** Build an Apple Health/Wallet/Settings-inspired design system and responsive
app shell on top of Stage 0's scaffold — theme tokens, a small `components/apple/` UI library,
Sidebar/BottomTabBar/AppShell layout, dark mode via `next-themes`, and a static placeholder
dashboard — all presentational, no data models or API routes.

**What was built:**
- `app/globals.css` — extended (not replaced) shadcn's existing Tailwind v4 `@theme inline` /
  `:root` / `.dark` tokens: overrode `--background` (`#F5F5F7` light / `#000000` dark), `--card`
  (`#FFFFFF` light / `#1C1C1E` dark), `--border` (`#E5E5EA` light / `oklch(1 0 0 / 12%)` dark),
  `--accent` (`#0A84FF` Apple blue, same in both modes), `--ring`. Added new tokens
  `--success`/`--warning`/`--danger`/`--vip` (+ `-foreground` pairs) with real Apple HIG dynamic
  color values (dark-mode variants are brighter: `#30D158`/`#FF453A`/`#BF5AF2`), wired into
  `@theme inline` as `--color-success` etc. so Tailwind v4 auto-generates `bg-success`,
  `text-vip/15`, `border-danger`, and so on. Added `--shadow-card` + a `.shadow-apple-card`
  utility for the low-opacity card shadow.
- `lib/icon-map.ts` — `ICON_PROPS` (size 20, strokeWidth 1.75) shared convention, and
  `CATEGORY_ICON_MAP: Record<string, LucideIcon>` seeded with `jewellery`/`beauty`/`skincare`/
  `makeup`/`default`, plus a `getCategoryIcon()` helper. Documented as intentionally small —
  later billing stages will add more specific keys (e.g. `jewellery-gold`) without reshaping it.
- `lib/use-media-query.ts` — `useMediaQuery()` and `useMounted()`, both built on
  `useSyncExternalStore` rather than `useState`+`useEffect`. **Deviation/gotcha:** this repo's
  ESLint config enforces the newer `react-hooks/set-state-in-effect` rule, which flags the
  common `useEffect(() => setState(...), [])` "mounted" and media-query patterns as errors (not
  warnings) — `useSyncExternalStore` is the fix and is a small enough abstraction to share.
- `components/apple/`: `AppleCard`, `AppleButton` (primary/secondary/destructive/ghost,
  framer-motion spring hover/tap), `AppleSheet` (dialog on `md:` desktop, bottom sheet on mobile,
  switched via `useMediaQuery`), `SegmentedControl` (controlled, animated active-pill via
  `layoutId`), `StatTile`, `Avatar` (initials, deterministic string-hash → color from an 8-color
  palette), `Badge` (vip/new/inactive/success/danger/neutral variants mapped to the status
  colors), `EmptyState`, `motion.tsx` (`PageTransition`, `StaggerList`/`StaggerItem`).
- `components/layout/Sidebar.tsx`, `BottomTabBar.tsx`, `AppShell.tsx`, `components/theme-provider.tsx`
  — Sidebar is collapsible (icon-only at 72px) with nav items for all 7 routes from the brief plus
  a dark-mode toggle and collapse toggle; BottomTabBar shows 4 primary tabs + a "More" button that
  opens a shadcn `Sheet` listing the remaining 3 routes; AppShell always mounts both and toggles
  visibility with `hidden md:block` / `md:hidden` (avoids hydration mismatch from
  conditionally-rendering based on viewport).
- `app/layout.tsx` — `next/font/google` `Inter` (variable `--font-sans`, matching what shadcn's
  `@theme inline` already expected) with an explicit system-font `fallback` array; mounts
  `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`) → `AppShell` → `children`, plus
  shadcn's `Toaster` (sonner). `suppressHydrationWarning` on `<html>` per next-themes' own
  documented requirement.
- `app/page.tsx` — placeholder dashboard: 3 `StatTile`s ("Today's Customers", "Total Sales",
  "Birthdays Today", all zero/₹0) each inside an `AppleCard`, wrapped in `StaggerList`/`StaggerItem`
  for the fade-in-cascade.
- Added shadcn primitives via `npx shadcn add`: `card`, `sheet`, `dialog`, `tabs`, `badge`,
  `avatar`, `separator`, `skeleton`, `dropdown-menu`, `sonner`.

**Why / deviations:**
- **shadcn is on a different stack than typically expected**: `components.json` uses style
  `base-nova` and the installed primitives (`button.tsx`, `sheet.tsx`, `dialog.tsx`, `badge.tsx`,
  `avatar.tsx`) are built on `@base-ui/react` (Radix's newer sibling), not classic Radix UI, and
  `lucide-react` is already on a `1.x` major (not the usual `0.4xx`). None of this required
  different code from what the brief asked for, but it's worth knowing before assuming
  Radix-specific APIs (`asChild`, etc.) — base-ui uses a `render` prop instead.
- Overriding shadcn's existing `--accent` token (rather than inventing a separate brand-color
  variable) was a deliberate call: shadcn already uses `--accent`/`--accent-foreground` as the
  focus/hover highlight color in components like `dropdown-menu` (`focus:bg-accent`). Repointing
  it at Apple blue makes those focus states look like macOS's native blue menu-item highlight,
  which is more Apple-authentic than introducing a second, unused accent variable — and it's
  still a single variable a later brand pass (gold/rose) can swap.
- `AppleButton` is a standalone `motion.button`-based component rather than a wrapper around
  shadcn's `Button`, because that `Button` is a `@base-ui/react` render-prop primitive — composing
  `framer-motion`'s `whileTap`/`whileHover` through it would need `render={<motion.button/>}`
  gymnastics for no real benefit given the brief wants a distinct Apple-styled variant set anyway.
- Sidebar/BottomTabBar are both always rendered (never conditionally mounted based on a JS media
  query) so there's no hydration mismatch or content flash — Tailwind's `hidden md:block` /
  `md:hidden` does the switching in CSS only.

**Verification:**
- `npx tsc --noEmit` — clean, no errors.
- `npx eslint .` — clean. (Had to fix two `react-hooks/set-state-in-effect` errors during
  development, see `use-media-query.ts` above.)
- `npm run build` — compiles successfully, `/` prerenders as static content.
- `npm run dev` + Playwright: loaded `http://localhost:3000/`, zero console errors/warnings.
  Screenshotted at 1440×900 (desktop, sidebar visible, cards in a 3-col grid) and 390×844 (mobile,
  BottomTabBar visible, cards stacked, Sidebar absent). Clicked the sidebar's dark-mode toggle —
  background/card/border/accent/status colors all switched correctly with no white-on-white or
  invisible text. Clicked mobile's "More" tab — bottom sheet opened showing Lists/Reports/Settings
  with correct dark styling. Dev server stopped after verification.

**Next:** Stage 2 — Prisma schema & seed.

---

## Stage 2 — Prisma Schema & Seed

**Prompt/request:** Write the full Prisma schema (Customer, Bill, MessageTemplate, MessageLog,
OwnerNotification, User + supporting enums), run the initial migration against the live Neon DB
from Stage 0, build a hot-reload-safe `lib/prisma.ts` singleton using the Prisma 7 driver-adapter
pattern, and write a seed script populating 25 realistic dummy customers + bills + message
templates + one OWNER login user, then verify everything independently.

**What was built:**
- `prisma/schema.prisma` — added `Customer`, `Bill`, `MessageTemplate`, `MessageLog`,
  `OwnerNotification`, `User` models plus `Gender`, `MessageType`, `MessageStatus`, `Role` enums,
  exactly as specified (cuid ids, `createdAt`/`updatedAt` on every model, indexes on
  frequently-filtered fields like `lastVisitDate`, `totalPurchaseAmount`, `birthday`,
  `anniversary`, `date`, `category`, `status`, `type`). Existing `generator`/`datasource` blocks
  untouched.
- `npx prisma migrate dev --name init` applied cleanly against the live Neon DB
  (`20260722161306_init`), confirming Stage 0's direct/unpooled connection setup in
  `prisma.config.ts` works for Migrate. Also had to run `npx prisma generate` explicitly once —
  `migrate dev` created the migration but the generated client output directory
  (`lib/generated/prisma`) didn't appear until `generate` was run (worth noting in case this
  looks like a no-op the first time).
- `lib/prisma.ts` — singleton `PrismaClient` built with `@prisma/adapter-pg`'s `PrismaPg` adapter
  wrapping a `pg.Pool` constructed from the pooled `DATABASE_URL`, cached on `globalThis` to avoid
  exhausting Neon connections across Next.js dev hot-reloads. Imports `PrismaClient` from
  `./generated/prisma/client` (the actual generated entry point — confirmed by inspecting
  `lib/generated/prisma/client.ts`, which explicitly documents the `new PrismaPg({ connectionString
  })` adapter pattern in its own doc comment).
- `prisma/seed.ts` — seeds:
  - 1 `User` (OWNER): `owner@kangnabeauty.in` / password `password123` (bcrypt-hashed with 10
    rounds before insert). **This plaintext password is for local dev/testing only** — needed for
    Stage 10's login flow testing.
  - 25 customers with Indian names, unique-looking 10-digit mobile numbers, gender spread across
    all 4 `Gender` enum values, 10 different `areaLocality` values, and `favouriteCategory` drawn
    from a fixed 4-label set (`Jewellery`, `Beauty`, `Skincare`, `Makeup`) also reused as `Bill`
    categories. Birthdays/anniversaries are a mix of `null` and set; 5 customers get dates computed
    as offsets from `new Date()` at seed-run time (not hardcoded calendar dates) so they land within
    the "current week" whenever the seed is re-run: `+2`, `+3`, `-2` (deliberately *before* today to
    exercise backward/cross-boundary matching), `+5`, `+1` days. The `-2`-day case is the
    "wraparound" case called for in the brief — it naturally crosses a month (and potentially year)
    boundary whenever seeded near the start of a month; today (2026-07-22) it lands on 2026-07-20,
    still same-month, so the true year-boundary case wasn't exercised on *this* run, but the logic
    is date-relative so it will self-exercise correctly if reseeded in early January.
  - 1–8 `Bill` rows per customer, dates spread over the last 365 days, unique sequential `billNo`
    values (`INV-2026-00001` style).
  - 6 `MessageTemplate` rows, one per non-`CUSTOM` `MessageType` value (`BIRTHDAY`, `ANNIVERSARY`,
    `FESTIVAL`, `NEW_ARRIVALS`, `MONTHLY_OFFER`, `WE_MISS_YOU`), each with a `{{placeholder}}`-bearing
    body. `CUSTOM` intentionally has no stock template, per the brief.
  - **Rollup-fields decision:** chose to *compute and write* `totalPurchaseAmount`, `totalVisits`,
    `averageBillValue`, `lastVisitDate`, and `favouriteCategory` on each `Customer` row after
    inserting its bills, using the same aggregate approach (sum/count/avg/max-date/mode-category)
    the real rollup-maintenance logic will use — rather than leaving them at schema defaults. This
    was chosen over the "leave at 0/null" alternative because later UI stages (dashboard stat
    tiles, VIP/segment filters, customer list sort-by-spend) will likely be built and manually
    checked against this seed data before Stage 4's billing module exists to keep these fields
    live-updated on every new bill — all-zero rollups would make that data look structurally broken
    rather than just "not yet wired." Stage 4 remains the source of truth for keeping these correct
    as new bills are added post-seed.
- **Deviation — Prisma 7 moved seed config location:** `npx prisma db seed` initially failed with
  "No seed command configured" even with `package.json`'s `"prisma": {"seed": "tsx prisma/seed.ts"}`
  present (added per the brief, and left in place) — Prisma 7 no longer reads that field at all.
  It now requires `migrations.seed` inside `prisma.config.ts`. Added
  `seed: "tsx prisma/seed.ts"` to the existing `migrations` block there (purely additive — the
  `datasource`/`url` config from Stage 0 was left untouched). Documenting this since the brief's
  instruction not to touch `prisma.config.ts` was specifically about the DB connection config, and
  this was a necessary, non-destructive addition to make seeding work at all under Prisma 7.
- Also hit (and worked around): Prisma 7's `PrismaClient` doesn't auto-load `.env`/`.env.local` the
  way older versions implicitly did when run outside of `next dev` (which loads `.env.local`
  itself) or the Prisma CLI (which loads `.env` via `prisma.config.ts`'s own
  `import "dotenv/config"`). Standalone verification scripts run via `npx tsx` needed their own
  `import "dotenv/config"` at the top to populate `process.env.DATABASE_URL` before constructing
  the `pg.Pool`. `lib/prisma.ts` itself doesn't import dotenv — it relies on Next.js's own env
  loading, which is correct for its actual runtime context.

**Why:** See rollup-fields and seed-config deviations above; the driver-adapter pattern in
`lib/prisma.ts` follows directly from Stage 0's documented Prisma 7 requirement.

**Verification:**
- `npx prisma migrate dev --name init` — applied cleanly, no errors, confirmed against the live
  Neon DB (schema `public`, `neondb`).
- `npx tsc --noEmit` — clean, no errors.
- Independent verification script (written standalone, checked "within 7 days" itself via
  month/day comparison rather than trusting the seed script's own offset logic, then deleted):
  - `Customer.count()` → **25**
  - One `User` row with `role: OWNER` → **found**, `owner@kangnabeauty.in`
  - `MessageTemplate.count()` → **6**
  - Every customer's bill count → **min 1, max 8** (0 customers outside `[1,8]`)
  - All `billNo` values → **114 total, 0 duplicates**
  - Customers with birthday/anniversary within 7 days of today (2026-07-22) → **4** found
    (Priya Sharma birthday 07-24, Anjali Verma anniversary 07-25, Kavita Nair anniversary 07-27,
    Sunita Patel birthday 07-23), satisfying the "at least 2-3" requirement.
- `lib/prisma.ts` verified by importing it from a throwaway script (`import "dotenv/config"` +
  `prisma.customer.count()` → returned 25 successfully), then the script was deleted.

**Next:** Stage 10 — Auth.

---

## Stage 10 — Auth

**Prompt/request:** Build NextAuth v5 (Credentials + Prisma) end-to-end: `lib/auth.ts` config,
module-augmented types, the App Router API route, a shared zod login schema, `middleware.ts` route
protection, a `requireRole` server helper for future API routes, an Apple-styled `/login` page, a
`SessionProvider` in the root layout, and a sign-out affordance in the Sidebar.

**What was built:**
- Confirmed installed version: **`next-auth@5.0.0-beta.32`** (checked
  `node_modules/next-auth/package.json` directly rather than assuming). v5's `index.d.ts` confirms
  the factory shape: `export const { handlers, auth, signIn, signOut } = NextAuth({ providers, ... })`,
  no old `NextApiHandler` pattern. `next-auth/middleware` is explicitly marked deprecated in its own
  `.d.ts` in favor of using the `auth` export directly as a middleware wrapper (confirmed via
  `lib/index.d.ts`'s `NextAuthRequest`/`WithAuthArgs` types).
- **Split the NextAuth config into two files** — this was the one real surprise, not anticipated in
  the brief:
  - `lib/auth.config.ts` — edge-safe `NextAuthConfig` (session strategy, `pages`, `jwt`/`session`
    callbacks that copy `id`/`role` onto the token/session), **no providers**.
  - `lib/auth.ts` — spreads `authConfig` and adds the real `Credentials` provider (`authorize` looks
    up `User` via `lib/prisma.ts`, `bcryptjs.compare`s the password, returns `{id, name, email, role}`
    or `null`). Exports `handlers`, `auth`, `signIn`, `signOut`.
  - **Why:** `middleware.ts` runs on the Edge runtime. Importing `lib/auth.ts` directly from
    middleware pulled in `lib/prisma.ts` → the generated Prisma client, which loads Node built-ins
    (`node:path`, `node:url`) at module scope — Edge can't bundle these, and `npm run dev` failed
    with `Failed to load external module node:path`. `middleware.ts` builds its own lightweight
    `NextAuth(authConfig)` instance (no providers, so no Prisma import) purely to call `auth()` for
    JWT-cookie verification, which needs no DB access under the JWT session strategy anyway. This is
    the same split pattern NextAuth's own docs recommend for Credentials+Prisma+Middleware setups.
- `types/next-auth.d.ts` — module augmentation on `next-auth` (`Session.user`, `User`) and
  `next-auth/jwt` (`JWT`) adding `id: string` and `role: "OWNER" | "STAFF"` (aliased as `AppRole` in
  the same file), so `session.user.role` is typed everywhere with no `as any`.
- `app/api/auth/[...nextauth]/route.ts` — `export const { GET, POST } = handlers`.
- `lib/validations/auth.ts` — `loginSchema` (zod): `email` (required + email format), `password`
  (required). Shared between the login form's `zodResolver` and `lib/auth.ts`'s `authorize`
  (`loginSchema.safeParse(credentials)` before hitting the DB).
- `middleware.ts` — wraps `auth()` (from the edge-safe `authConfig` instance) as the default export;
  redirects unauthenticated requests to `/login`, and redirects already-authenticated requests away
  from `/login` back to `/`. `matcher` excludes `api/auth`, `_next/static`, `_next/image`,
  `favicon.ico`. Only decides "logged in or not" — no role gating here per the brief.
- `lib/auth/requireRole.ts` — `requireRole(role: AppRole | AppRole[])`, returns a discriminated union
  `{ ok: true, session } | { ok: false, response: NextResponse }`. **Chosen over throwing:** route
  handlers already return `Response`/`NextResponse`, so `const guard = await requireRole("OWNER"); if
  (!guard.ok) return guard.response;` composes as a natural early-return with the right 401/403 status
  codes preserved, versus a thrown error needing try/catch in every caller (or falling through to
  Next's generic 500 boundary and losing the intended status code). Documented inline in the file.
- **Route restructure to keep `/login` chrome-free without touching Stage 1's `AppShell`/`Sidebar`/
  `BottomTabBar` component internals:** moved the dashboard into a route group,
  `app/(app)/page.tsx` (URL unaffected — group segments don't appear in the path), with a new
  `app/(app)/layout.tsx` that wraps children in `AppShell`. `app/login/page.tsx` lives outside that
  group, so it renders under the root layout only — no Sidebar/BottomTabBar — giving the "centered
  card, no distracting background" look the brief asked for. `app/layout.tsx` no longer mounts
  `AppShell` directly (moved to the group layout); it now mounts `SessionProvider` (new,
  `components/providers/SessionProvider.tsx`, thin client wrapper around `next-auth/react`'s
  `SessionProvider`) around `{children}` + the existing `Toaster`, inside the existing `ThemeProvider`
  — `ThemeProvider`'s own setup was left untouched.
- `app/login/page.tsx` — client component. `react-hook-form` + `@hookform/resolvers/zod` +
  `loginSchema`. Built from `AppleCard`/`AppleButton` (Stage 1 components, reused not redesigned).
  On submit calls `next-auth/react`'s `signIn("credentials", { email, password, redirect: false })`;
  shows an inline `role="alert"` message on failure (`result.error` truthy), `router.push("/")` +
  `router.refresh()` on success (the refresh ensures the server-rendered tree picks up the new
  session immediately rather than waiting on client cache).
- `components/layout/Sidebar.tsx` — added a "Sign out" button in the existing bottom section
  (alongside the dark-mode toggle and collapse toggle), calling `next-auth/react`'s
  `signOut({ callbackUrl: "/login" })`. Only this small addition was made; no other Sidebar internals
  changed.

**Why:** See the Edge/Prisma config-split rationale and the `requireRole` return-vs-throw rationale
above — both are documented in the source files themselves as well so they aren't re-discovered
later. The route-group restructure was chosen over adding conditional logic inside `AppShell` (which
would have meant editing a Stage 1 design-system file) or inside root `layout.tsx` via
`usePathname` (which would force the root layout to be a client component) — route groups keep both
existing files' responsibilities intact and are the idiomatic App Router way to give one route a
different shell.

**Verification:**
- `npx tsc --noEmit` — clean (had to `rm -rf .next` once after moving `app/page.tsx` into the route
  group, since Next's cached route-type validator briefly pointed at the old path).
- `npm run dev`, then exercised the full flow both via `curl` (cookie jar, manual CSRF-token dance
  against `/api/auth/csrf` → `/api/auth/callback/credentials` → `/api/auth/session`) and via
  Playwright in a real browser:
  - Unauthenticated `GET /` → **307 to `/login`** (curl), confirmed again in-browser (`page.goto("/")`
    landed on `/login`).
  - `/api/auth/session` unauthenticated → `null`.
  - Valid login (`owner@kangnabeauty.in` / `password123`) via curl's raw credentials callback →
    `302` with a `Set-Cookie` for `authjs.session-token`, and `/api/auth/session` afterward returned
    `{"user":{"name":"Kangna Store Owner","email":"owner@kangnabeauty.in","id":"...","role":"OWNER"},"expires":...}`
    — confirms the `jwt`/`session` callbacks correctly attach `id` and `role`. `GET /` with that
    cookie → `200`.
  - Invalid password via curl → `302` to `/login?error=CredentialsSignin`, session stayed `null`.
  - In-browser: filled the login form with the wrong password → inline "Invalid email or password."
    alert appeared, no crash, form stayed usable. Corrected the password and submitted → redirected
    to `/` and the dashboard (Sidebar + 3 stat tiles) rendered correctly, with the new "Sign out"
    button visible in the Sidebar's bottom section. Clicked "Sign out" → redirected back to
    `/login`. Confirmed via curl afterward that the session cookie was cleared
    (`Set-Cookie: authjs.session-token=; Max-Age=0`) and `GET /` with the stale cookie jar redirected
    to `/login` again (`307`).
  - Dev server stopped after verification (`pkill -f "next dev"`).

**Next:** Stage 3 — Customer registration & profile.

---

## Stage 3 — Customer Registration & Profile

**Prompt/request:** Build customer registration and profile screens end-to-end: a shared zod
schema, server-side query functions, `/api/customers` + `/api/customers/[id]` route handlers,
a reusable `CustomerForm`, a `QuickAddSheet`, `CustomerBadges`, a tabbed `CustomerProfileTabs`,
and the three pages (`/customers`, `/customers/new`, `/customers/[id]`) — all built on Stage 1's
design system and Stage 2's live Prisma schema, gated by Stage 10's `requireRole`.

**What was built:**
- `lib/validations/customer.ts` — `customerSchema` (full create/update schema: `name` min 2 chars,
  `mobileNumber` regex `^[6-9]\d{9}$`, optional `birthday`/`anniversary` via a
  string-or-Date-to-`Date` transform so `<input type="date">`'s raw string output converts
  cleanly, optional `areaLocality`, optional `gender` matching the Prisma `Gender` enum exactly
  but re-declared locally rather than imported — keeps this file safely importable from client
  components without pulling in the generated Prisma client bundle), `customerUpdateSchema`
  (`.partial()` of the same), and `quickAddCustomerSchema` (just `name` + `mobileNumber`, for
  `QuickAddSheet`).
- `lib/queries/customers.ts` — `getAllCustomers()` (simple `findMany` ordered by name, `take`
  param for a future cap; deliberately no filter/sort logic — that's Stage 8), `getCustomerById()`
  (includes `bills` desc-by-date and `messagesLog` desc-by-createdAt), `getVipCustomerIds()` (top
  10% by `totalPurchaseAmount`, minimum 1 customer — a separate query rather than a stored flag,
  since "top 10%" is inherently relative to the whole customer base and would go stale on a
  per-row flag), `createCustomer()` and `updateCustomer()` — both check for a colliding
  `mobileNumber` *before* attempting the write and return a discriminated-union result
  (`{ ok: true, customer }` / `{ ok: false, reason: "duplicate_mobile", existingCustomerId }`)
  rather than letting a raw Prisma P2002 unique-constraint error bubble up, so API routes can
  respond with a clean 409 + the existing customer's id.
- `app/api/customers/route.ts` — `GET` (list, `requireRole(["OWNER","STAFF"])`), `POST` (create,
  validates with `customerSchema.safeParse`, returns 400 with `z.treeifyError()` issues on
  validation failure, 409 + `existingCustomerId` on duplicate mobile, 201 + the created customer
  otherwise).
- `app/api/customers/[id]/route.ts` — `GET` (single customer via `getCustomerById`, 404 if
  missing), `PATCH` (validates with `customerUpdateSchema`, same 409-on-duplicate /
  404-on-missing / 400-on-invalid shape as POST).
- `components/customers/CustomerForm.tsx` — `react-hook-form` + `@hookform/resolvers/zod` +
  `customerSchema`. **Notable generics detail:** because `customerSchema` *transforms* date
  strings into `Date`s, its zod "input" type (what `<input type="date">` actually produces) and
  "output" type (`CustomerInput`, post-transform) differ — used `useForm`'s 3-generic signature
  (`useForm<z.input<typeof customerSchema>, unknown, CustomerInput>`) so form fields stay typed as
  raw strings while `handleSubmit`'s callback receives the already-transformed `Date`s, with no
  manual re-parsing needed. Fields: Name/Mobile (shadcn `Input`+`Label`, added in this stage since
  Stage 1 hadn't actually installed them despite the brief's assumption — see deviations),
  Birthday/Anniversary (native `<input type="date">` — no shadcn date-picker/calendar/popover
  component existed yet and adding one felt like over-building for a stage that just needs a date
  value, per the brief's own "skip it unless trivial" guidance), Area/Locality (plain text input,
  no autocomplete — same reasoning), Gender (Stage 1's `SegmentedControl`, Female/Male/Other).
  Mobile-number duplicate errors render inline with a `Link` to the existing customer's profile.
  Reusable for both create (`app/(app)/customers/new/page.tsx`, no `defaultValues`) and edit
  (`CustomerProfileTabs`'s "Edit Details" tab, `defaultValues` from the loaded customer + an
  `onSubmit` that calls the `PATCH` endpoint).
- `components/customers/QuickAddSheet.tsx` — wraps Stage 1's `AppleSheet`, owns its own `open`
  state internally (no external state control needed for the common case — documented in the
  file), accepts an optional `trigger` (cloned via `React.cloneElement` to attach the open-click
  handler without introducing a wrapping `<span>`) or falls back to a default "Quick Add"
  `AppleButton`. Just Name + Mobile Number, posts straight to `/api/customers`, shows the same
  inline duplicate-with-link UX as the full form, and calls `router.refresh()` on success so the
  server-rendered `/customers` list picks up the new row immediately (client-side dialog state
  alone doesn't trigger the server component to re-fetch).
- `components/customers/CustomerBadges.tsx` — VIP (caller-computed `isVip` prop, since only the
  caller has cross-customer visibility to know "top 10%"), New (`customerSince` within 30 days),
  Inactive (`lastVisitDate` more than 60 days ago, or `null`/never-visited — chose 60 over the
  brief's suggested 30/60/90 range as a reasonable single default, matching what a jewellery/beauty
  business's typical repeat-visit cadence would be, without adding a config surface this stage
  doesn't need). Note a deliberate co-occurrence: a freshly-registered customer with no bills yet
  shows *both* "New" and "Inactive" — arguably correct (new **and** hasn't visited yet), verified
  in the browser check below. The `Date.now()` read is isolated into a plain non-component helper
  function (`computeStatusFlags`) rather than inline in the component body — this repo's ESLint
  config has a `react-hooks/purity` rule that flags impure calls (`Date.now`, `Math.random`, etc.)
  made directly inside a component's render; wrapping it in an ordinary (non-capitalized, not
  detected as a component) helper function satisfies the rule while keeping the same behavior.
- `components/customers/CustomerProfileTabs.tsx` — Stage 1's `SegmentedControl` switches between
  "Visit History" (bills list — date/billNo/amount/category, `getCategoryIcon` per row, Stage 1's
  `EmptyState` if none — bill *creation* stays out of scope, that's Stage 4), "Messages Sent"
  (`MessageLog` list, `EmptyState` if none — expected to be empty right now since Stage 6 hasn't
  built sending yet), "Edit Details" (`CustomerForm` pre-filled, PATCHes, `router.refresh()` +
  a `sonner` toast on success).
- Pages: `app/(app)/customers/page.tsx` (server component; `Promise.all([getAllCustomers(),
  getVipCustomerIds()])`; each customer card's identity/stats section is wrapped in a `Link` to
  the profile, but the `tel:`/`wa.me` action row sits *outside* that `Link` as two sibling anchors
  — nesting anchors inside an anchor is invalid HTML and was hit during first-draft development,
  fixed by not nesting rather than intercepting clicks with `preventDefault`; mounts
  `QuickAddSheet` and a "+ New Customer" link next to the heading), `app/(app)/customers/new/page.tsx`
  (client component wrapping `CustomerForm`, POSTs, toasts, `router.push` to the new profile on
  success), `app/(app)/customers/[id]/page.tsx` (server component, `notFound()` if missing, header
  with `Avatar`/tel/wa.me/badges, favourite-category pill using `lib/icon-map.ts`'s
  `getCategoryIcon` rendered via `createElement` rather than JSX — see deviations — a 6-tile stat
  row (`StatTile` × Customer Since/Total Purchase/Total Visits/Avg Bill Value/Last Visit/Loyalty
  Points, explicitly commented as reading static DB values with no live-recalculation until Stage
  4), then `CustomerProfileTabs`).

**Why / deviations:**
- **shadcn `input`/`label`/`select` didn't actually exist yet** despite Stage 1's log implying
  they might — checked `components/ui/` first (per the brief's own instruction) and found only
  `card`/`sheet`/`dialog`/`tabs`/`badge`/`avatar`/`separator`/`skeleton`/`dropdown-menu`/`sonner`.
  Ran `npx shadcn add input label select` to add them; used as-is, no internals modified.
  Consistent with the same `base-nova`/`@base-ui/react` stack Stage 1 documented.
- **No date-picker/calendar shadcn component was added.** `<input type="date">` covers the
  brief's actual requirement (pick a birthday/anniversary date) without pulling in
  `popover`+`calendar` and building a custom picker UI — the brief explicitly says to check before
  adding and not over-build, and a native date input is a legitimate, accessible choice here.
- **ESLint's `react-hooks/static-components` rule blocks the common "look up a Lucide icon
  component into a variable, then render `<Variable />`" pattern** when that pattern sits directly
  in a named component's own render body (it does *not* flag the same pattern inside a `.map()`
  callback passed to JSX, which is why `CustomerProfileTabs`'s bill-row icon lookup needed no
  change but the profile page's single favourite-category icon did). Worked around in
  `app/(app)/customers/[id]/page.tsx` by rendering that one icon via `createElement(getCategoryIcon(...), props)`
  instead of JSX — avoids the lint's AST pattern (a JSX tag whose name is a locally-assigned
  variable) entirely without changing what actually renders. Documented in case a cleaner
  general-purpose fix (e.g. a `<CategoryIcon category={...} />` component in `lib/icon-map.ts`)
  is worth building once more call sites need it.
- **`QuickAddSheet` calls `router.refresh()` on success** — first-draft version didn't, and a
  browser-verification pass caught that the customer *was* created (confirmed via a direct DB
  query) but didn't appear in the `/customers` list until a manual reload, because the list is a
  Server Component fetched once at navigation time and closing a client-side dialog doesn't
  re-trigger that fetch. Fixed and re-verified.
- **Nested `<a>` avoided by scoping `Link` to part of the customer card**, not the whole card —
  see pages section above.
- Rollup stats (`totalPurchaseAmount`, `totalVisits`, `averageBillValue`, `lastVisitDate`,
  `loyaltyPoints`) shown on the profile page are read directly from whatever's currently stored on
  the `Customer` row — nothing in this stage recalculates them on new bills/visits; that's Stage
  4's job, exactly as scoped.

**Verification:**
- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean (after fixing the two `react-hooks/purity` / `react-hooks/static-components`
  issues described above).
- `npm run dev` + Playwright, logged in as `owner@kangnabeauty.in` / `password123`:
  - `/customers` — all 25 seeded customers rendered as cards with Avatar/name/mobile, VIP/New/
    Inactive badges computed correctly (e.g. Aarti Desai/Manoj Mehta/Sanjay Joshi showed VIP;
    several long-since-visited customers showed Inactive), `tel:`/`wa.me` links present and
    correctly formatted (`https://wa.me/91<number>`), "27 customers registered" count updated live
    after later test creates.
  - `/customers/[id]` for Aarti Desai (has 8 seeded bills) — header, VIP badge, "Favourite:
    Jewellery" pill, all 6 stat tiles populated from seed data, Visit History tab listing all 8
    bills with correct date/category/amount formatting, Messages Sent tab correctly empty
    (`EmptyState`, since `MessageLog` has no rows yet).
  - Edit Details tab — form pre-filled correctly (including gender defaulting to the stored
    `MALE` value, confirming `defaultValues` wiring), changed Area/Locality to "Bandra West",
    clicked Save Changes, reloaded the page, and independently queried the DB directly — the
    change persisted.
  - `/customers/new` — registered "Neelam Kapoor" (9988776655, Powai) — redirected to her new
    profile with a success toast, stat tiles correctly all-zero/"Never", badges correctly showed
    both "New" and "Inactive" (never visited), then confirmed she appeared in the `/customers`
    list on reload.
  - Duplicate-mobile-number handling — via `QuickAddSheet`, tried submitting Aarti Desai's mobile
    number (`9800003974`) for a different name: got the inline "A customer with this mobile number
    already exists" message with a working "View their profile" link, no crash, dialog stayed
    open and usable. Corrected the number and resubmitted successfully (confirmed created via
    direct DB query after the `router.refresh()` fix).
  - No console errors during any of the above (one expected `409` network-log entry from the
    intentional duplicate-mobile test, not an application error).
  - Dev server stopped after verification (`pkill -f "next dev"`).

**Next:** Stage 4 — Billing & Rollups.

---

## Stage 4 — Billing & Rollups

**Prompt/request:** Build billing end-to-end — a zod schema for bills, the core
`recalculateCustomerRollup`/`createBillWithRollup`/`updateBill`/`deleteBill` query functions,
`/api/bills` + `/api/bills/[id]` routes, an `AddBillForm`, a global `AddBillGlobalSheet` (search
existing customer or quick-create one, then add a bill), a reusable `BillHistoryTable` replacing
the read-only bill list in `CustomerProfileTabs`, and wiring an "+ Add Bill" entry point into the
Sidebar and the customers page — all gated by `requireRole`, with correctness independently
verified against a from-scratch aggregation script since Stages 5 and 7 depend on these numbers.

**What was built:**
- `lib/validations/bill.ts` — `BILL_CATEGORIES` (exported const array: `Jewellery - Gold/Diamond/
  Silver`, `Beauty Services`, `Skincare`, `Makeup`, `Other` — a starter fixed list per the brief,
  not yet Settings-driven), `billSchema` (`billNo` required string, `date` required — a
  string-or-Date union transformed to `Date`, mirroring `customer.ts`'s date-handling pattern but
  required rather than optional — `amount` required positive number via a string-or-number union
  transform rather than `z.coerce.number()` — chosen specifically so the form's `z.input` type
  stays a plain `string` instead of `unknown`, which is what `z.coerce.number()`'s input type
  resolves to in zod v4 and would break `register()`'s typing — `category`/`customerId` required
  strings), `billUpdateSchema` (`.partial()`).
- `lib/queries/bills.ts` — the correctness-critical core:
  - `recalculateCustomerRollup(customerId, tx)` — takes a `Prisma.TransactionClient` (exported from
    the generated client's `Prisma` namespace), queries **all** of that customer's `Bill` rows
    fresh from the DB every time (no incremental/running-total trust, since bills can be edited or
    deleted, not just created), and computes `totalVisits` (count), `totalPurchaseAmount` (sum),
    `averageBillValue` (0 if no visits), `lastVisitDate` (max date, `null` if none), and
    `favouriteCategory` (highest **summed amount** per category, tie-broken by bill **count**,
    `null` if no bills) — then writes all five fields back onto the `Customer` row in the same
    transaction.
  - `createBillWithRollup(data)` — transaction: checks `billNo` uniqueness up front (returns
    `{ok:false, reason:"duplicate_billNo"}` rather than a raw P2002, mirroring `createCustomer`'s
    duplicate-mobile pattern), checks the target customer exists, creates the `Bill`, calls
    `recalculateCustomerRollup`, returns `{ok:true, bill, customer}`.
  - `updateBill(id, data)` / `deleteBill(id)` — both transaction-wrapped, look up the bill's
    current `customerId` first, perform the update/delete, then recalculate rollup for the
    affected customer(s) — `updateBill` specifically recalculates **both** the old and new
    customer if `data.customerId` changes which customer a bill belongs to.
  - **Transaction timeout deviation (found during browser verification, not anticipated in the
    brief):** Prisma's interactive-transaction defaults (`maxWait: 2000ms` to acquire a connection,
    `timeout: 5000ms` for the transaction body) were consistently too tight against this project's
    Neon connection, which round-trips in the 2-3s range from local dev — every `$transaction` call
    in this file threw `P2028: Unable to start a transaction in the given time` on the *first*
    attempt of a fresh request, succeeding only on retry. Fixed by passing an explicit
    `TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 }` to all three `$transaction` calls
    in this file. This is a real latency characteristic of the dev-to-Neon connection, not a bug in
    the transaction logic itself — documented here in case it resurfaces once real billing volume
    or slower networks are involved.
- `lib/queries/customers.ts` — added minimal search support: `getAllCustomers({ q })` now does a
  case-insensitive `OR` match on `name`/`mobileNumber` when `q` is passed (existing no-arg call
  sites unaffected). Added specifically for `AddBillGlobalSheet`'s customer search rather than
  duplicating this query elsewhere — Stage 8's fuller filter/sort system can build on top of it.
  `app/api/customers/route.ts`'s `GET` now reads `?q=` from the URL and passes it through.
- `app/api/bills/route.ts` — `POST` only (validates with `billSchema`, 409 on duplicate `billNo`,
  404 if the customer doesn't exist, 201 + `{bill, customer}` on success), gated by
  `requireRole(["OWNER","STAFF"])`.
- `app/api/bills/[id]/route.ts` — `GET`/`PATCH`/`DELETE`, same auth gating, backed by
  `getBillById`/`updateBill`/`deleteBill`.
- `components/bills/AddBillForm.tsx` — `react-hook-form` + `zodResolver(billSchema)`, same
  `z.input`/output-generic split `CustomerForm` uses. Bill No. pre-filled via a `suggestBillNo()`
  helper (`INV-{year}-{random 4-digit}`, fully editable, not guaranteed unique — the API's 409
  handles collisions) generated once via `useState`'s lazy initializer to respect this repo's
  `react-hooks/purity` rule around `Math.random()` in render bodies (same pattern
  `CustomerBadges` established in Stage 3). Date defaults to today via a native
  `<input type="date">`, matching `CustomerForm`'s convention. Category uses shadcn's `Select`
  (confirmed unused anywhere else in the repo before this — first real usage of the `base-ui/react`
  Select primitives added in Stage 3 but never wired up), controlled locally and merged into the
  POST body since RHF's own registration of a custom `Select` would need extra plumbing this
  didn't seem worth adding for one field. Takes `customerId` + `onSuccess`.
- `components/bills/AddBillGlobalSheet.tsx` — self-contained, owns its own `open` state and
  accepts an optional `trigger` (same clone-with-onClick pattern `QuickAddSheet` established).
  Three internal steps: `search` (debounced `GET /api/customers?q=`, 300ms — debounce implemented
  via a `useRef`-held `setTimeout` triggered from the input's `onChange` handler rather than a
  `useEffect` watching the query string, specifically to avoid this repo's
  `react-hooks/set-state-in-effect` lint rule, which flagged the more obvious effect-based version),
  `quickAdd` (inline compact create-customer mini-form — not `QuickAddSheet` itself, since nesting
  an `AppleSheet` inside an already-open `AppleSheet` isn't a pattern this design system supports;
  re-implemented the same Name+Mobile-only flow and duplicate-mobile UX inline instead), `form`
  (`AddBillForm` scoped to whichever customer was found/created, with a "choose a different
  customer" back-link). Wired into `components/layout/Sidebar.tsx` as a prominent accent-colored
  "Add Bill" button between the header and nav (custom `trigger`), **and** into
  `app/(app)/customers/page.tsx`'s header row next to `QuickAddSheet`/"New Customer" — brief
  offered either placement as acceptable, both were added since they're cheap and serve different
  contexts (global-reach vs. customer-list-context).
- `components/bills/BillHistoryTable.tsx` — extracted from `CustomerProfileTabs`'s previously-inline
  read-only bill list (Date/BillNo/Amount/Category, defensively re-sorted reverse-chronological even
  though the query already orders that way), added a "+ Add Bill" button opening `AppleSheet` →
  `AddBillForm` scoped to `customerId`, with `onSuccess` calling `router.refresh()` — same pattern
  Stage 3 discovered was required for `QuickAddSheet` (client-side sheet state closing doesn't
  re-trigger the parent Server Component's data fetch on its own).
- `components/customers/CustomerProfileTabs.tsx` — Visit History tab now renders
  `<BillHistoryTable customerId={customer.id} bills={bills} />` instead of the inline list; removed
  the now-unused `formatCurrency`/`Receipt`/`getCategoryIcon` imports from this file (still used
  inside `BillHistoryTable` itself).

**Why / deviations:**
- **Transaction timeout bump** — see above; a genuine environment-latency finding, not a design
  choice, fixed with explicit `$transaction` options rather than touching `lib/prisma.ts`'s pool
  config (out of scope per the brief's "don't touch Stage 1/10 internals" constraint, and the fix
  belongs at the call site anyway since it's specific to these multi-query transactions).
- **`favouriteCategory` computed by highest summed amount (tie-break by count), not by bill count
  alone** — this was specified explicitly in this stage's brief, but differs from how Stage 2's
  seed script computed the same field (its own log entry describes a "mode-category" / most
  frequent-by-count approach). This surfaced as 16 real diffs in the independent verification
  script's first run (all `favouriteCategory` mismatches, zero mismatches on the numeric/date
  fields) — not a bug in `recalculateCustomerRollup`, but confirmation that the seed's one-time
  approximation used different logic than the spec. Fixed by running a one-time backfill (a
  throwaway script calling the real `recalculateCustomerRollup` for all 27 customers, then
  deleted) rather than changing the verification script's expectations — Stage 2's own log already
  states "Stage 4 remains the source of truth for keeping these correct," so recomputing seed data
  under the real implementation was the correct fix, not a workaround.
- **`quickAdd` step inside `AddBillGlobalSheet` reimplements a mini customer-create form instead of
  reusing `QuickAddSheet`** — `QuickAddSheet` owns its own `AppleSheet`, and nesting one
  `Dialog`/`Sheet` inside another open one isn't something this design system's components are
  built to support cleanly. Reusing the validation (`quickAddCustomerSchema`) while duplicating
  just the inline form JSX was the pragmatic middle ground over either building a
  sheet-in-sheet or a bigger refactor of `QuickAddSheet` into a headless/rendered-inline variant.
- **Search debounce via `useRef` + `setTimeout` triggered from `onChange`, not `useEffect`** — see
  component notes above; this repo's `react-hooks/set-state-in-effect` ESLint rule (first
  encountered in Stage 1 for a different pattern) flags synchronous `setState` calls in an effect
  body, which a straightforward `useEffect(() => {...}, [query])` debounce would trip.

**Verification:**
- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean (after fixing the `react-hooks/set-state-in-effect` violation in
  `AddBillGlobalSheet` and an unused-import warning in `CustomerProfileTabs`, both described above).
- `npm run dev` + Playwright, logged in as `owner@kangnabeauty.in` / `password123`:
  - Opened Priya Sharma's profile (2 seeded bills, ₹14,732 total, 2 visits, ₹7,366 avg, last visit
    31 Mar 2026), added a bill via the Visit History tab's "+ Add Bill" (₹5,500, Skincare, today) —
    **first submit attempt hit the P2028 transaction-timeout bug** described above (caught live
    during this exact verification pass), fixed the transaction options, retried, and the stat
    tiles updated correctly with no manual reload: Total Purchase ₹20,232, Total Visits 3, Avg
    ₹6,744, Last Visit 22 Jul 2026 — all arithmetically correct.
  - Used the global "+ Add Bill" button (Sidebar), searched "priya", got exactly one matching
    result, selected her, added a second bill (₹12,000, Jewellery - Diamond) — landed on the
    correct customer, stat tiles updated again: Total Purchase ₹32,232, Total Visits 4, Avg
    ₹8,058, favourite category correctly switched to "Jewellery - Diamond" (₹12,000 single bill
    beating the prior ₹10,464 Jewellery bill by summed amount).
  - Direct API tests (curl, authenticated via the NextAuth credentials callback): `PATCH
    /api/bills/[id]` changing one bill's amount (₹5,500→₹9,999) and category (Skincare→Makeup)
    succeeded; `DELETE /api/bills/[id]` on a different bill succeeded. Reloaded the profile —
    Total Purchase ₹32,463, Total Visits 3 (post-delete), Avg ₹10,821, bill list reflected both the
    edit and the removal — all correct, confirming rollups stay correct after mutation, not just
    creation.
  - No unexpected console errors (the P2028 errors during the timeout investigation were expected
    application errors surfaced correctly as inline "Network error" messages, not silent failures
    or crashes — form state was preserved across the failed attempt, letting a plain retry work).
  - Dev server stopped after verification.
- **Independent rollup-consistency check** (throwaway `scripts-tmp-verify-rollups.ts`, written with
  its own from-scratch aggregation logic — a plain-object category tally rather than
  `recalculateCustomerRollup`'s `Map`-based one — specifically so it could catch bugs in that
  function rather than assume it's correct; deleted after use):
  - **First run** (25 seeded customers + 2 new customers from Stage 3 testing = 27 customers, 116
    bills after this stage's UI testing): **16 diffs**, all `favouriteCategory` mismatches
    explained above (Stage 2 seed vs. this stage's spec), **zero** diffs on `totalVisits`,
    `totalPurchaseAmount`, `averageBillValue`, or `lastVisitDate` — meaning the numeric/date rollup
    math was correct on the very first implementation.
  - Ran a one-time backfill (`scripts-tmp-backfill-rollups.ts`, called the real
    `recalculateCustomerRollup` for all 27 customers, deleted after use) to bring seed-time
    `favouriteCategory` values in line with the spec.
  - **Second run** (same 27 customers, 116 bills): **0 diffs.**
  - **Third run**, after the curl-driven `PATCH` (edit) and `DELETE` mutations above (27 customers,
    115 bills post-delete): **0 diffs.** Confirms `updateBill`/`deleteBill`'s rollup recalculation
    is correct, not just `createBillWithRollup`'s.
  - Final state: **0 diffs, verified across create, update, and delete paths.**

**Next:** Stage 5 — Automatic Customer Lists.

---

## Stage 5 — Automatic Customer Lists

**Prompt/request:** Build `lib/queries/customer-lists.ts` (load-bearing for Stage 6's WhatsApp
We-Miss-You queue, Stage 7's dashboard, and Stage 8's notifications cron), a `/lists` page using
Stage 1's `SegmentedControl` to switch between 5 automatic customer lists, and a reusable
`CustomerListTable` component with Call/WhatsApp/View-Profile quick actions.

**What was built:**

- **`lib/queries/customer-lists.ts`** — the five list functions, plus a shared recurrence helper.
  Exact exported signatures (unchanged from here on, per the brief — all params optional so future
  stages can call with no args):

  ```ts
  export function daysUntilNextOccurrence(date: Date, from?: Date): number
  export function isWithinRecurringWindow(date: Date, days: number, from?: Date): boolean

  export interface RecurringDateEntry { customer: Customer; daysUntil: number }
  export async function getBirthdaysThisWeek(from?: Date): Promise<RecurringDateEntry[]>
  export async function getAnniversariesThisWeek(from?: Date): Promise<RecurringDateEntry[]>

  export interface InactiveCustomerEntry { customer: Customer; daysSinceLastVisit: number | null }
  export async function getInactiveCustomers(days?: 30 | 60 | 90, from?: Date): Promise<InactiveCustomerEntry[]>

  export async function getTopSpenders(limit?: number): Promise<Customer[]>
  export async function getNewCustomersThisMonth(from?: Date): Promise<Customer[]>
  ```

  - `daysUntilNextOccurrence` is the shared birthday/anniversary recurrence helper. Rather than
    subtracting raw `Date`s (which breaks across the Dec→Jan boundary), it builds the candidate
    occurrence of `date`'s month+day in `from`'s own year via `Date.UTC`, and rolls it forward to
    `from`'s year + 1 if that candidate is already before `from`'s midnight. This handles
    wraparound exactly without needing explicit `% 366` bookkeeping, because `Date.UTC` already
    normalizes calendar math consistently. Known edge case: a Feb 29 birthday in a non-leap
    `from`-year normalizes to Mar 1 via `Date.UTC` — accepted as-is for this app's scale.
    `isWithinRecurringWindow(date, days, from)` wraps it as a boolean (`daysUntil <= days`) and is
    reused by both `getBirthdaysThisWeek`/`getAnniversariesThisWeek` conceptually, though the list
    functions inline the `daysUntil <= 6` filter directly since they also need the numeric value
    for sorting/display, not just the boolean.
  - `getBirthdaysThisWeek`/`getAnniversariesThisWeek`: fetch all customers with a non-null
    birthday/anniversary (small dataset, fine to filter in JS rather than push month/day math into
    SQL), compute `daysUntil` via the helper, keep entries with `daysUntil <= 6` (today
    through today+6, a 7-day window), sort ascending.
  - `getInactiveCustomers(days)`: customers where `lastVisitDate` is `null` OR strictly more than
    `days` days in the past (`lastVisitDate < now - days*24h`, strict `<`/`>`, not `<=`/`>=`) —
    **boundary decision:** a customer whose last visit was *exactly* `days` days ago is **not**
    counted as inactive yet at that threshold; they cross into it the following day. This mirrors
    `CustomerBadges`' existing `INACTIVE_AFTER_DAYS` convention (`> 60`, not `>= 60`) so Stage 5's
    lists stay consistent with the Inactive badge already shown on customer cards/profiles.
    **Sort/null-position decision:** never-visited customers (`lastVisitDate: null`) sort **first**
    (treated as "more inactive than any dated last visit"), then the rest sort by
    `daysSinceLastVisit` descending (most days stale next). Verified live against seed data: no
    seeded customer currently has `lastVisitDate: null`, so a synthetic customer was used to
    exercise this path (see Verification below).
  - `getTopSpenders(limit)`: excludes customers with `totalPurchaseAmount: 0` — **decision:** "top
    spenders" implies actual spend; a freshly-registered customer with no bills yet isn't a
    meaningful entry on a spend leaderboard. Returns plain `Customer[]` (no wrapper object) since
    `totalPurchaseAmount` is already a field on `Customer` — no need to invent a `{ customer, ...}`
    shape when the one relevant metric is already on the object.
  - `getNewCustomersThisMonth()`: real calendar-month window (1st of the current month 00:00
    through `from`), not a rolling 30-day window — distinct from `CustomerBadges`' "New" badge
    (`customerSince` within a rolling last-30-days), by design per the brief's explicit spec.

- **`components/lists/CustomerListTable.tsx`** — one reusable table for all 5 list types. Took a
  "pre-computed metric string" approach rather than a discriminated union of 5 row shapes: each
  row is `{ customer: { id, name, mobileNumber }, metricLabel: string, metricVariant?: "default" |
  "warning" | "success" | "vip" }`, and the page computes the domain-specific `metricLabel` (e.g.
  "Birthday · In 2 days", "Last visit 45 days ago", "₹48,200 spent", "Member since Jul 2026")
  before handing rows to the table. This keeps the table itself free of any list-type branching —
  it only knows how to render "identity + one metric + actions" — and avoids 5 near-identical
  table components. Actions per row: `tel:` Call link, plain `wa.me/91<mobile>` WhatsApp link (no
  pre-filled message — Stage 6 builds the templated composer), and a `Link` to
  `/customers/[id]`. Uses Stage 1's `EmptyState` inside an `AppleCard` when a list is empty.
  **Deviation caught during verification:** an early version put `onClick={(e) =>
  e.stopPropagation()}` on the Call/WhatsApp anchors (leftover instinct from the customers page's
  nested-Link pattern) — but this component isn't a Server Component with nested interactive
  Links, it's returned directly from `page.tsx`'s server render, and passing an event-handler prop
  to a plain `<a>` from a Server Component throws ("Event handlers cannot be passed to Client
  Component props"). Removed the handlers — they were unnecessary here since the Call/WhatsApp/
  View-profile anchors are siblings of the identity `Link`, not nested inside it.

- **`app/(app)/lists/page.tsx`** — server component, no client-side data fetching and no new API
  route. Reads `view`/`days` from `searchParams`, calls the relevant `customer-lists.ts` function
  server-side, maps results to `CustomerListRow[]`, and renders `CustomerListTable`. Chose this
  over the brief's alternative (client component + API route) because `SegmentedControl` only
  needs a `value`/`onChange` — turning `onChange` into a `router.push` with an updated search
  param is enough to get URL-driven segment switching without introducing a fetch waterfall or a
  new `app/api/customer-lists/route.ts` that would just re-wrap the same query functions. No
  `requireRole` needed here (unlike the API routes under `app/api/`) because `/lists` already sits
  under `middleware.ts`'s session-required matcher, same as every other page in the `(app)` route
  group — `requireRole` is specifically for route handlers that don't otherwise go through that
  redirect.

- **`components/lists/ListsSegmentedNav.tsx`** — small `"use client"` wrapper around Stage 1's
  `SegmentedControl` that reads `useSearchParams`/`useRouter` and pushes `/lists?<param>=<value>`
  on change, preserving other existing params (e.g. switching `view` keeps `days` intact for when
  the user returns to the Inactive tab). Used twice on the page: once for the 5 main list tabs
  (`view` param) and once for the Inactive tab's 30/60/90 day-threshold selector (`days` param,
  only rendered when `view=inactive`).

- Sidebar's "Lists" nav item (`/lists`) already existed as a placeholder from Stage 1 — no Sidebar
  changes needed.

**Verification:**
- `npx tsc --noEmit`: clean, no errors.
- Independent throwaway verification script (`tsx`, deleted after use) re-derived each of the 5
  lists directly from raw `Customer` rows using fresh logic (a brute-force day-by-day search for
  `daysUntilNextOccurrence` rather than the real function's `Date.UTC` rollover math) and diffed
  against the actual query functions on the live seeded dataset:
  - Birthdays this week: expected 2, actual 2, **match** — Sunita Patel (+1d), Priya Sharma (+2d).
  - Anniversaries this week: expected 2, actual 2, **match** — Anjali Verma (+3d), Kavita Nair
    (+5d). (Consistent with Stage 2's MEMORY.md note that these land at +1/+2/+3/+5 days as of
    2026-07-22, modulo which day the seed actually ran.)
  - Inactive 30+/60+/90+ days: 17/13/9 customers respectively, **set-match** against independent
    re-derivation.
  - Top spenders: 20/20 **match**, values and order identical (top 5: Manoj Mehta ₹70,980, Aarti
    Desai ₹67,170, Sanjay Joshi ₹61,336, Kiran Chopra ₹58,004, Deepak Reddy ₹57,246).
  - New this month: 2/2 **match**.
  - **Wraparound stress test** (synthetic, non-DB): Dec 29 → Jan 2 event = 4 days (pass), Dec 31 →
    Jan 1 = 1 day (pass), Jan 1 → Dec 31 (last year's date) = 364 days, i.e. correctly *not*
    treated as "just happened" (pass), same-day event = 0 days (pass).
  - **Live-DB wraparound test:** inserted a synthetic customer with `birthday` = Jan 2 (year
    irrelevant), called `getBirthdaysThisWeek(fakeToday)` with `fakeToday` = Dec 29, 2026 — the
    synthetic customer was correctly returned with `daysUntil: 4`. Deleted immediately after.
  - **Exactly-30-days-ago boundary test:** inserted a synthetic customer with `lastVisitDate` set
    to exactly `now - 30 days`, confirmed `getInactiveCustomers(30)` does **not** include them
    (strict `>`, matching the documented boundary decision above). Deleted immediately after.
  - No test-pollution customers (`name` starting with `"ZZ Test"`) remain in the DB — confirmed via
    a follow-up query after cleanup.
- `npm run dev` + Playwright browser automation, logged-in session, visited `/lists`:
  - **Birthdays** tab (default): Sunita Patel ("Birthday · Tomorrow"), Priya Sharma ("Birthday ·
    In 2 days") — matches seed data.
  - **Inactive** tab: 30/60/90 segmented sub-selector renders only on this tab; at 30+ days shows
    17 rows, never-visited customers ("Test Duplicate", "Neelam Kapoor" — both from earlier
    Stage 3 manual UI testing, not seed data) sorted first with "Never visited", followed by dated
    entries descending from 305 days down to 30 days.
  - **Top Spenders** tab: 20 rows, Manoj Mehta ₹70,980 first, descending correctly to Sunita Patel
    ₹17,606.
  - **New This Month** tab: 2 rows (the same two manually-created Stage 3 test customers), "Member
    since Jul 2026".
  - One bug caught and fixed during this pass: `CustomerListTable`'s Call/WhatsApp anchors
    originally had `onClick={(e) => e.stopPropagation()}`, which crashed the server render
    ("Event handlers cannot be passed to Client Component props") since the component is plain
    server-rendered JSX, not a Client Component — removed, unnecessary anyway since those anchors
    aren't nested inside another interactive element here.
  - Dev server stopped after verification.

**Deviations from the brief:** None of substance. The brief explicitly left the client-fetch-vs-
URL-param decision open ("your call, but keep it simple and working over clever") and offered the
API route as conditional ("if you need an API route ... per point 2's design decision") — the
URL-param + server-component approach didn't need one, so `app/api/customer-lists/route.ts` was
not created.

**Next:** Stage 7 — Dashboard.

---

## Stage 7 — Dashboard

**Prompt/request:** Replace the Stage 1/10 placeholder dashboard (`app/(app)/page.tsx`) with the
real thing: aggregate stat tiles, a 30-day revenue chart, a sales-by-category donut chart, mini
lists for birthdays/anniversaries this week, and an inactive-customers "Needs Attention" summary —
all server-rendered, reusing Stage 5's `lib/queries/customer-lists.ts` unchanged.

**What was built:**
- `lib/queries/dashboard-stats.ts` — new dashboard-specific aggregate queries, kept separate from
  `customer-lists.ts` (which Stage 6/8 depend on unchanged):
  - `getTodaysCustomerCount(from?)` — distinct `customerId`s from `Bill`s dated today (local
    calendar day), via `findMany({ distinct: ["customerId"] })`.
  - `getTotalSales(period: "today" | "month", from?)` — `Bill.aggregate` sum of `amount` over the
    local calendar day or month-to-date.
  - `getRepeatCustomerCount()` — `Customer.count({ totalVisits: { gt: 1 } })`.
  - `getStoreAverageBillValue()` — total sum of all bill amounts / total count of all bills
    store-wide (the more-correct definition per the brief, not an average of each customer's own
    `averageBillValue`, which would weight every customer equally regardless of visit count).
  - `getDailySalesLast30Days(from?)` — one `{ date: "YYYY-MM-DD", total }` entry per day for the
    last 30 days including today, zero-filling days with no sales so the chart never shows a gap.
  - `getSalesByCategory()` — `Bill.groupBy(["category"])` summed and sorted descending, for the
    donut chart.
  - `getDashboardStats(from?)` — combines all of the above (run via `Promise.all`) into one object
    for the page to consume in a single call. Deliberately does NOT reimplement
    birthdays/anniversaries/inactive-customer logic — the page fetches those directly from
    `customer-lists.ts`.
- `app/(app)/page.tsx` — rebuilt as an async server component. Fetches `getDashboardStats()` plus
  `getBirthdaysThisWeek()`, `getAnniversariesThisWeek()`, and `getInactiveCustomers(30/60/90)` in
  parallel, derives `birthdaysToday`/`anniversariesToday` by filtering `daysUntil === 0`, and
  composes the extracted components below. Wrapped in `PageTransition` (Stage 1's
  `components/apple/motion.tsx`).
- `components/dashboard/StatTilesRow.tsx` — client component (needs local `useState` for the
  Today/This-Month toggle only — no new fetches happen on toggle, both numbers are already
  server-fetched props). First tile is a custom `AppleCard` with `StatTile` + a `SegmentedControl`
  underneath for the sales-period toggle; the other six are plain `StatTile`-in-`AppleCard`
  tiles: Today's Customers, Birthdays Today, Anniversaries Today, Repeat Customers, Average Bill
  Value, Inactive Customers (30+ days).
- `components/dashboard/RevenueChart.tsx` — client component, Recharts `AreaChart` of the 30-day
  daily sales, gradient-filled area under an accent-colored line. All colors reference the Stage 1
  CSS variable tokens directly (`var(--accent)`, `var(--border)`, `var(--muted-foreground)`,
  `var(--card)`, `var(--card-foreground)`) rather than hardcoded hex, so it re-themes automatically
  with light/dark mode — no separate dark chart theme needed.
- `components/dashboard/CategoryBreakdownChart.tsx` — client component, Recharts donut `PieChart`
  of sales-by-category with a vertical right-aligned legend. Uses a fixed 7-color category palette
  (`CATEGORY_COLORS`): the five Stage 1 status tokens (`--accent`/`--success`/`--warning`/
  `--danger`/`--vip`) plus two extra fixed hex swatches matching `Avatar`'s existing palette
  (already legible in both themes), cycling if more categories are ever added. Renders `EmptyState`
  instead of a chart when there's no sales data yet.
- `components/dashboard/MiniListCard.tsx` — generic scrollable mini-list (`AppleCard`, title, icon,
  "View all" link, `Avatar` + name + days-until per row, `max-h-72 overflow-y-auto`, empty state).
  Used for both "Birthdays This Week" and "Anniversaries This Week", linking to
  `/lists?view=birthdays` / `/lists?view=anniversaries` — matching Stage 5's actual `view` query
  param convention read in `app/(app)/lists/page.tsx`.
- `components/dashboard/NeedsAttentionCard.tsx` — `AppleCard` listing 30+/60+/90+ day inactive
  counts, each linking to `/lists?view=inactive&days=30|60|90` (Stage 5's actual `days` param).
- `app/(app)/loading.tsx` — Apple-style shimmering skeleton (shadcn `Skeleton`, `animate-pulse`)
  matching the real layout: header, 7-tile stat grid, two chart cards, three mini-list/attention
  cards.

**Verification:**
- `npx tsc --noEmit` clean. One real TS issue hit and fixed along the way: Recharts' `Tooltip`
  `formatter` prop types `value` as `ValueType | undefined`, not `number` — narrowed the formatter
  signatures to accept the untyped params and `Number(value)`/`String(name)` inside instead of
  annotating them as `number`/`string`.
- Wrote a throwaway `scripts/verify-dashboard-stage7.ts` (deleted after use) that called
  `getDashboardStats()` alongside independent raw Prisma queries and diffed them. All matched
  exactly: `repeatCustomerCount` 22 === `Customer.count({ totalVisits: { gt: 1 } })` 22;
  `totalSalesMonth` ₹106,574.30 === raw `Bill.aggregate` for the current calendar month
  ₹106,574.30; `storeAverageBillValue` ₹7,877.4874 === total bill sum (₹905,911.05) / total bill
  count (115); `todaysCustomerCount` 1 === distinct `customerId`s from today's bills.
  `inactive30/60/90` = 17/13/9; `birthdaysThisWeek` = 2 (0 today); `anniversariesThisWeek` = 2 (0
  today).
- `npm run dev`, loaded `/` already authenticated (persisted session): every StatTile matched the
  verify script's numbers exactly (Total Sales ₹21,999 today / ₹1,06,574 this month via the
  toggle, Today's Customers 1, Birthdays Today 0, Anniversaries Today 0, Repeat Customers 22,
  Average Bill Value ₹7,877, Inactive Customers 17). Mini-lists matched `/lists?view=birthdays`
  (Sunita Patel "Tomorrow", Priya Sharma "In 2 days") and `/lists?view=anniversaries` (Anjali
  Verma "In 3 days", Kavita Nair "In 5 days"). "Needs Attention" counts (17/13/9) matched
  `/lists?view=inactive&days=30/60/90`. Toggled Today/This-Month — updated instantly with no new
  network request. Both charts rendered with no hydration errors or console warnings (the only
  console message was a pre-existing, unrelated `pg` SSL-mode deprecation warning from the
  driver adapter, present before this stage). Toggled dark mode via the sidebar button and
  re-screenshotted: revenue chart line/gradient/axis labels/tooltip and the category donut/legend
  all stayed fully legible, no invisible text or vanishing chart colors. Dev server stopped after
  verification.

**Deviations from the brief:** None of substance. Added `NeedsAttentionCard.tsx` as its own file
(not explicitly named in the brief, which only named `StatTilesRow`/`MiniListCard`) purely to keep
`page.tsx` thin per the brief's own stated preference for composed-not-inlined page components.

**Next:** Stage 6 — WhatsApp Messaging.

---

## Stage 6 — WhatsApp Messaging

**Prompt/request:** Build link-mode WhatsApp messaging end-to-end: `lib/whatsapp/{link-mode,
cloud-mode,send}.ts`, `lib/queries/{message-templates,message-log}.ts` (CRUD + a placeholder
renderer + the log reader `CustomerProfileTabs` already expected), `/api/templates` +
`/api/templates/[id]` + `/api/messages/send` + `/api/messages/bulk-send` routes, a template
management page + `TemplateEditor`, a one-click "Send Message" sheet on the customer profile, a
`/messages/campaigns` bulk campaign builder with quick-pick audiences (reusing Stage 5's list
functions unchanged) + manual multi-select, a click-through `SendQueueList`, and an owner-approval
`WeMissYouPanel` fed by `getInactiveCustomers(30)` — Cloud API left a documented stub per the
brief's explicit non-goal.

**What was built:**
- **`lib/whatsapp/link-mode.ts`** — `buildWaMeLink(phoneNumber, message)`. Strips non-digits from
  the input, prefixes `91` only when the result is exactly 10 digits (the DB's stored format per
  `lib/validations/customer.ts`'s `^[6-9]\d{9}$` regex — confirmed before writing this), otherwise
  passes the digits through as-is (handles an already-12-digit or `+`-prefixed number without
  double-prefixing). Message is `encodeURIComponent`-ed. **Exact format landed on:**
  `https://wa.me/<91+10digits>?text=<encoded>` — real example produced during verification:
  `https://wa.me/919800001234?text=Happy%20Birthday%20Priya%20Sharma!%20%F0%9F%8E%89%20Wishing%20you%20a%20year%20filled%20with%20joy%20and%20sparkle.%20Visit%20us%20this%20week%20for%20a%20special%20birthday%20treat!`
  (note the emoji correctly percent-encoded as `%F0%9F%8E%89`).
- **`lib/whatsapp/cloud-mode.ts`** — stub `sendMessageCloud(params): Promise<SendMessageResult>`
  matching `send.ts`'s own result type exactly (not a thrown error — consistent with this repo's
  established discriminated-union-over-throw convention from `createCustomer`/`createBillWithRollup`),
  always returns `{ ok: false, error: "WHATSAPP_MODE=api is not supported yet — ..." }`. Documents
  in a comment what a real Cloud API implementation would need (Bearer token + phone-number-id env
  vars, `PENDING`→webhook-driven status updates) without building any of it — genuinely a non-goal.
- **`lib/whatsapp/send.ts`** — `sendMessage({ customerId, type, body }): Promise<{ok:true, waLink,
  messageLogId} | {ok:false, error}>`. Reads `WHATSAPP_MODE` (default `"link"`), routes to
  `cloud-mode.ts` if set to `"cloud"`/`"api"`, otherwise: looks up the customer's `mobileNumber`,
  builds the wa.me link, and **creates the `MessageLog` row itself** (`status: "SENT"`, `sentAt:
  now`) before returning the link. **Design decision (documented inline in the file and here per
  the brief):** link mode has zero server-side delivery confirmation available — no webhook, no
  receipt — so a message either gets logged as `PENDING` forever (useless as a "sent" history) or
  as a deliberate best-effort `SENT` the moment the app hands the owner/staff a working wa.me link.
  Chose the latter: `SENT` here means "the app produced a send link for this message," not
  "WhatsApp confirmed delivery." `DELIVERED`/`READ` stay reserved for a real future Cloud API
  integration that can receive delivery webhooks. This matches the original spec's stated intent
  for link mode.
- **`lib/queries/message-templates.ts`** — `getAllTemplates()`, `getTemplateById(id)`,
  `getTemplatesByType(type)`, `createTemplate(data)`, `updateTemplate(id, data)`, and
  `renderTemplate(body, customer)`. Placeholder set: `{{name}}`, `{{loyaltyPoints}}`,
  `{{lastVisitDate}}` (formatted via `date-fns`'s `format(..., "d MMM yyyy")`),
  `{{favouriteCategory}}` — matches `prisma/seed.ts`'s existing `{{placeholder}}` syntax exactly
  (confirmed by reading the seed file's 6 template bodies before writing this). **Fallback
  decision:** missing/null fields render a warm human-readable default rather than a raw token or
  blank gap — `lastVisitDate` → `"your last visit"`, `favouriteCategory` → `"our collection"`,
  `name` → `"Valued Customer"` (belt-and-suspenders only, `name` is required on `Customer`).
  Unrecognized `{{tokens}}` are left untouched (not stripped) so a typo is visibly wrong in the
  live preview instead of silently vanishing.
- **`lib/queries/message-log.ts`** — `createMessageLog(data)` (for future call sites that don't go
  through `send.ts`'s own inline create, e.g. a future Cloud API webhook handler) and
  `getMessageLogsForCustomer(customerId)`, ordered most-recent-first — wired into
  `CustomerProfileTabs.tsx`'s already-existing "Messages Sent" tab (that tab's `EmptyState` was
  built in Stage 3 with a comment saying it'd stay empty until this stage; no changes needed to
  `CustomerProfileTabs.tsx` itself since it already read `messages: MessageLog[]` from
  `customer.messagesLog` via `getCustomerById`, which was already ordered desc by `createdAt` per
  Stage 3's log).
- **API routes**, all gated `requireRole(["OWNER","STAFF"])`:
  - `app/api/templates/route.ts` (GET all, POST create) and `app/api/templates/[id]/route.ts` (GET
    one, PATCH title/body/isActive).
  - `app/api/messages/send/route.ts` (POST) — accepts `{customerId, templateId}` or `{customerId,
    body, type}` (zod `.refine()` requires one or the other), renders via `renderTemplate`, calls
    `sendMessage()`, returns `{waLink, messageLogId, body}`.
  - `app/api/messages/bulk-send/route.ts` (POST) — `{customerIds, templateId}`, loops
    sequentially calling `sendMessage()` per recipient (pre-renders each customer's own
    placeholders, e.g. their own `loyaltyPoints`/`favouriteCategory`, not a shared body), returns
    `{results: [{customerId, customerName, waLink, messageLogId}], failures: [...]}` — failures
    (e.g. a customer id that no longer exists) don't abort the whole batch, they're just excluded
    from `results` and reported separately.
- **`app/(app)/messages/templates/page.tsx`** + **`components/messages/TemplateEditor.tsx`** —
  server page lists all templates via `getAllTemplates()`, each rendered by `TemplateEditor` (a
  `"use client"` card: title input, body textarea, an `isActive` pill toggle, and a live preview
  panel that re-renders on every keystroke against a fixed sample customer — Priya Sharma / 120
  pts / today / Jewellery, exactly the brief's example — using a small client-local render
  function rather than importing `renderTemplate` directly, since that file imports `lib/prisma.ts`
  at module scope and would otherwise pull the Prisma client into the browser bundle). "Save
  Changes" PATCHes `/api/templates/[id]` and toasts; a full reload re-fetches the server component
  and shows the persisted value (verified in Verification below).
- **`components/messages/SendMessageSheet.tsx`** — the one-click send, wired into
  `app/(app)/customers/[id]/page.tsx`'s header (next to the existing VIP/New/Inactive badges).
  Self-contained `AppleSheet` trigger (same "owns its own open state" pattern as Stage 3/4's
  `QuickAddSheet`/`AddBillGlobalSheet`): on open, fetches active templates from `GET
  /api/templates`, lets the owner pick one, live-renders the preview for *this specific customer*
  (client-local render mirror, same reasoning as `TemplateEditor`), and "Send via WhatsApp" POSTs
  `/api/messages/send`, then `window.open(waLink, "_blank")` (still inside the click handler's own
  call stack, so not popup-blocked), toasts, closes the sheet, and calls `router.refresh()` so the
  profile's "Messages Sent" tab picks up the new log row without a manual reload — same
  `router.refresh()`-after-mutation pattern Stage 3/4 established.
- **`components/messages/CampaignBuilder.tsx`** + **`app/(app)/messages/campaigns/page.tsx`** —
  page (server component) fetches `getAllTemplates()`, `getAllCustomers()`, and four Stage-5 quick
  audiences unchanged (`getInactiveCustomers(30)`, `getTopSpenders(20)`, `getBirthdaysThisWeek()`,
  `getAnniversariesThisWeek()`), passes them to the client `CampaignBuilder`: pick a template (native
  `<select>`), pick an audience via `SegmentedControl` (one of the 4 quick-picks, or "Manual
  Select" — a search-filtered checkbox list over all customers), shows a live recipient count, then
  "Start Send Queue" swaps in `SendQueueList`.
- **`components/messages/SendQueueList.tsx`** — calls `/api/messages/bulk-send` once on mount
  (pre-rendering + logging every recipient up front), then walks the returned array one at a time:
  "Customer X of N" + a progress bar, and a "Send & Next" button whose `onClick` (a direct user
  gesture, not anything automatic) does `window.open(currentEntry.waLink, "_blank")` then advances
  the index — this is the actual mechanism that makes "bulk send" work at all in link mode, since
  browsers block programmatic multi-window opens not tied to a click. Shows a completion state
  ("All N messages sent") when exhausted.
- **`components/messages/WeMissYouPanel.tsx`** — owner-approval queue, rendered as its own card
  under `/messages/campaigns` (below `CampaignBuilder`), fed by the same `getInactiveCustomers(30)`
  call the page already made for the quick-pick audience (no duplicate query). Lists every
  30+-day-inactive customer with a checkbox (all pre-checked by default, individually
  deselectable), a "Send to N" button, and on click swaps in the same `SendQueueList` component
  used by `CampaignBuilder` — **no fully-automatic/silent send path exists anywhere in this
  stage**, every send (single or bulk) requires an explicit owner/staff click per the brief's
  stated intent for a beauty/jewellery brand's tone.

**Why / deviations:**
- **Client-side `renderTemplate` mirrors instead of shared imports** (in both `TemplateEditor.tsx`
  and `SendMessageSheet.tsx`) — `lib/queries/message-templates.ts`'s real `renderTemplate` is a
  pure function, but the file it lives in imports `lib/prisma.ts` at module scope (needed by the
  CRUD functions in the same file), which would pull the generated Prisma client into the client
  bundle if imported directly from a `"use client"` component. Splitting `renderTemplate` into its
  own prisma-free file was considered but felt like unnecessary churn for two small, intentionally
  duplicated ~10-line functions with an inline comment explaining why they're not shared — flagged
  here in case a third call site ever wants it, at which point extracting really would pay for
  itself.
- **`sendMessageCloud`'s stub returns a typed failure result, not a thrown error** — matches
  `send.ts`'s own `SendMessageResult` discriminated union exactly, consistent with this repo's
  established "return a typed failure, don't throw" convention from Stage 3/4's
  `createCustomer`/`createBillWithRollup`.
- **`bulk-send` loops sequentially (`for...of` with `await` inside), not `Promise.all`** — each
  iteration does a real DB write (`MessageLog.create`); sequential writes avoid opening many
  concurrent Neon connections/transactions for what's typically a small (tens, not thousands) batch
  size in this app's actual usage, and keeps `failures` easy to reason about per-recipient.
- **`WeMissYouPanel` and `CampaignBuilder` both render `SendQueueList` directly** rather than
  routing through a shared "campaign session" state — each owns its own `customerIds`/`templateId`
  hand-off locally (props into `SendQueueList`), which was simpler than introducing shared
  state/context for what's really two independent entry points into the same reusable queue UI.

**Verification:**
- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean except one expected warning (`_params` unused in `cloud-mode.ts`'s stub,
  intentional leading-underscore convention for an unused parameter). Fixed two real lint errors
  during development: an unescaped `'` in `campaigns/page.tsx` JSX text
  (`react/no-unescaped-entities`) and a `react-hooks/set-state-in-effect` violation in
  `SendMessageSheet.tsx` (first draft called `setLoading(true)` directly in the effect body instead
  of inside a nested async function — same rule/fix pattern Stage 4's `AddBillGlobalSheet` hit
  first).
- `npm run dev`, authenticated as `owner@kangnabeauty.in` / `password123` via the NextAuth
  credentials callback (curl cookie-jar dance, same approach Stage 3/10 used for direct API
  verification):
  - `GET /api/templates` → all 6 seeded templates returned correctly.
  - **Single send:** `POST /api/messages/send` for Priya Sharma (`9800001234`) with the BIRTHDAY
    template → `{"waLink":"https://wa.me/919800001234?text=Happy%20Birthday%20Priya%20Sharma!%20%F0%9F%8E%89%20Wishing%20you%20a%20year%20filled%20with%20joy%20and%20sparkle.%20Visit%20us%20this%20week%20for%20a%20special%20birthday%20treat!", ...}`
    — link format and encoding correct (emoji → `%F0%9F%8E%89`). A follow-up direct-DB read of the
    returned `messageLogId` confirmed the `MessageLog` row: `status: "SENT"`, `sentAt` populated,
    `type: "BIRTHDAY"`, `bodySent` matching the rendered text exactly.
  - Fetched `/customers/[Priya's id]` afterward (authenticated) — the server-rendered payload
    included the new message log entry (`"Happy Birthday Priya Sharma! ... status: SENT"`) inside
    the "Messages Sent" tab's data, and the `SendMessageSheet`'s "Send Message" trigger button was
    present in the page HTML.
  - **Bulk send:** `POST /api/messages/bulk-send` with 3 customer ids (Aarti Desai, Amit Malhotra,
    Anjali Verma) + the WE_MISS_YOU template → `results` array of 3, each with a distinct
    `messageLogId` and a correctly-encoded per-customer wa.me link (each customer's own name/number
    substituted, e.g. `.../919800003974?text=Hi%20Aarti%20Desai%2C%20it's%20been%20a%20while...`),
    `failures: []`. Direct DB read of all 3 returned `messageLogId`s confirmed all 3 `MessageLog`
    rows exist with `status: "SENT"` and `type: "WE_MISS_YOU"`. Total `MessageLog` row count after
    both tests: 4 (1 single + 3 bulk), matching expectations exactly.
  - **Template edit persistence:** `PATCH /api/templates/[BIRTHDAY id]` with a modified `body` →
    `200` with the new body in the response; a follow-up `GET` on the same template id (simulating
    a reload) returned the same modified body, confirming the save persisted server-side rather
    than only updating client state. Reverted the body back to the original seeded text afterward
    to leave seed data clean.
  - Loaded `/messages/templates`, `/messages/campaigns`, and a customer profile page — all `200`.
  - Dev server stopped after verification (`pkill -f "next dev"`); no leftover verification scripts
    left in the repo (all throwaway `scripts-tmp-*.ts` files were deleted after use, matching Stage
    4's established pattern).
  - **Not exercised via a real browser click** in this pass (curl/API + direct-DB verification was
    used instead, sufficient to confirm both the wa.me link *value* correctness and the
    `MessageLog` row creation for single and bulk sends, per the brief's own note that
    `window.open` may not visibly navigate in headless/automated testing anyway) — the UI
    components (`TemplateEditor`'s live preview, `SendMessageSheet`'s picker, `CampaignBuilder`'s
    audience selector, `SendQueueList`'s "Send & Next" progression) were verified by `tsc`/`eslint`
    passing clean and by reading the rendered page HTML/RSC payload for correct data wiring, not by
    clicking through them in a live browser session.

**Next:** Stage 8 — Search, Filters & Notifications.

---

## Stage 8 — Search, Filters & Notifications

**Prompt/request:** Build a global Cmd/Ctrl-K command palette, extend `/customers` with real
URL-param-driven filters on top of Stage 4's `q` search, and build an owner-notification system
(dedup'd queries, a `requireRole`-gated CRUD API, a `CRON_SECRET`-gated daily cron route reusing
Stage 5's list functions, and a `NotificationBell` UI) — all additive on top of Stages 1–7,
without touching `prisma/schema.prisma`.

**What was built:**

- **Global search:**
  - `lib/queries/search.ts` — `searchCustomers(query, limit = 8)`, a case-insensitive
    `contains` match on `name`/`mobileNumber`, minimal `select` (id/name/mobileNumber/
    lastVisitDate), capped and ordered by name. Deliberately its own file/function rather than
    reusing `getAllCustomers({ q })` — the command palette wants a tight field selection and a
    small fixed cap, not the full customer row shape.
  - `app/api/search/route.ts` — `GET ?q=...`, `requireRole(["OWNER","STAFF"])`-gated, returns
    `{ results: [] }` immediately for an empty/missing `q` without hitting the DB.
  - `npx shadcn add command` — added `components/ui/command.tsx` (cmdk-based, `base-ui/react`
    `Dialog` under `CommandDialog`) plus its `textarea`/`input-group` deps (unused elsewhere, came
    along for the ride).
  - `components/search/CommandPalette.tsx` — `"use client"`, global `keydown` listener for
    ⌘K/Ctrl-K (`document.addEventListener`, cleaned up on unmount), 300ms debounce via a
    `useRef`-held `setTimeout` fired from `CommandInput`'s `onValueChange` (not a `useEffect`
    watching the query string — this repo's `react-hooks/set-state-in-effect` ESLint rule, first
    hit in Stage 4's `AddBillGlobalSheet`, flags the more obvious effect-based debounce). Renders
    `<Command shouldFilter={false}>` inside `CommandDialog` — `shouldFilter` disabled because
    results are already server-filtered by `/api/search`; cmdk's own default client-side substring
    filter would otherwise run against the `value` prop (customer id) rather than the visible
    name/mobile text and hide every result. Each row: `Avatar` + name + mobile +
    `lastVisitDate` (formatted via `date-fns`, "Never visited" fallback); `onSelect` does
    `router.push('/customers/[id]')`.
  - **Mobile trigger, no shared state needed:** exported `openCommandPalette()` (dispatches a
    `window` custom event `"kangna:open-command-palette"`) and `CommandPaletteTrigger` (a plain
    search-icon button calling it) from the same file. `CommandPalette` listens for that event
    alongside its keydown listener. This avoids threading open/setOpen state from the
    globally-mounted `CommandPalette` (in `app/(app)/layout.tsx`) down into `BottomTabBar`/
    `Sidebar`, which live in an entirely different part of the tree.
  - Mounted `<CommandPalette />` once in `app/(app)/layout.tsx` (inside `AppShell`, as a sibling of
    `{children}`) so it's available on every authenticated screen without editing `AppShell.tsx`
    itself. Added a "Search" button to `BottomTabBar.tsx`'s nav row (calls `openCommandPalette`,
    5th icon alongside the existing 4 primary tabs + "More") for mobile, since there's no keyboard
    to press ⌘K on. Also added a search-icon button to `Sidebar.tsx`'s header row (next to the
    "Kangna CRM" title) for desktop, plus mounted `NotificationBell` there (see below).

- **Customer filters:**
  - `lib/queries/customers.ts`'s `getAllCustomers` extended (not replaced) with `category`
    (exact match on `favouriteCategory`), `visitFrequency` (`"1" | "2-5" | "6+"` bucket, mapped to
    a `totalVisits` range via a small `visitFrequencyToRange` helper — `"6+"` has no upper bound),
    `minSpend`/`maxSpend` (range on `totalPurchaseAmount`), `lastVisitFrom`/`lastVisitTo` (range on
    `lastVisitDate`). All filters (including the pre-existing `q`) are collected into a
    `Prisma.CustomerWhereInput[]` array and combined with `AND` — every filter is optional, so
    every existing no-arg/`{q}`-only call site (`AddBillGlobalSheet`, etc.) is unaffected.
  - `app/(app)/customers/page.tsx` — stayed a server component; per the brief's own note, Next.js
    server components read search params via the `searchParams` prop (here, `Promise<Record<string,
    string | string[] | undefined>>` — this Next version's async-params convention, confirmed by
    checking how `app/(app)/lists/page.tsx` already did it in Stage 5), not the client-only
    `useSearchParams` hook. Reads `category`/`visitFrequency`/`minSpend`/`maxSpend`/
    `lastVisitFrom`/`lastVisitTo` from `searchParams`, converts strings→`Date`/`Number` (the
    `lastVisitTo` raw date string is widened to `T23:59:59.999Z` so the whole "to" day is
    inclusive, not just its midnight instant), and passes them to `getAllCustomers`.
  - `components/customers/CustomerFilterBar.tsx` — a `"use client"` sub-component (same
    server-page + client-URL-pusher split Stage 5's `ListsSegmentedNav` established), rendered
    inside Stage 1's `AppleSheet` (a filter *sheet*, not an always-visible inline bar — brief left
    this open, and a sheet keeps the customers-page header uncluttered). Owns local `draft` state
    for the sheet's controls (category `Select` populated from `lib/validations/bill.ts`'s
    `BILL_CATEGORIES` — confirmed this is the actual value domain `favouriteCategory` is computed
    from, not a separate list; visit-frequency `Select`; min/max spend number `Input`s; from/to
    date `Input`s) and only pushes to the URL (preserving other existing params) on "Apply
    Filters"; "Clear all" strips every filter key and navigates immediately. A small badge on the
    "Filters" trigger button shows the count of currently-active URL filter params.
  - **shadcn `Select`/base-ui quirk hit and fixed:** base-ui's `Select.Value` shows the raw
    `value` string by default (e.g. the literal sentinel `"__any__"`) rather than the matching
    `SelectItem`'s label, unless given a children-as-function formatter or an `items` map on the
    root — confirmed via `node_modules/@base-ui/react/select/value/SelectValue.d.ts`. Fixed by
    passing `<SelectValue>{(value) => ...label lookup...}</SelectValue>` in both selects. Caught
    during the browser verification pass (see below), not by `tsc`/`eslint` — worth knowing since
    it's easy to reintroduce in a new `Select` without a children function.

- **Owner notifications:**
  - `lib/queries/notifications.ts` — **dedupe-key scheme** (the workaround the brief called for,
    since `OwnerNotification` has only `id/type/message/isRead/createdAt`, no dedicated dedup
    fields): every notification's `type` string embeds a stable identifier of what it's about,
    formatted `"<kind>:<customerId>"` — e.g. `"birthday:cmr..."`, `"inactive-30:cmr..."`,
    `"vip-top10:cmr..."`. `createNotificationIfNotExists({ type, message })` looks for an existing
    row with the **exact same `type` string** created within the last 24 hours
    (`createdAt >= now - 24h`); if found, skips (returns `{ created: false, reason: "duplicate" }`)
    instead of inserting. Every notification the cron route creates goes through this function, so
    re-running the cron on the same day is a no-op. Also `getUnreadNotifications()`,
    `getAllNotifications(limit = 50)`, `markAllRead()` (bulk `updateMany`), `markOneRead(id)`.
  - `app/api/notifications/route.ts` — `GET` (list, `requireRole`-gated) and `PATCH` (body
    `{ id }` or `{ all: true }` via a zod `z.union`, mark-read).
  - `app/api/cron/daily-check/route.ts` — gated by comparing `Authorization: Bearer <token>`
    against `process.env.CRON_SECRET` (401 on missing/mismatch), **not** `requireRole` (a cron
    trigger has no user session). Logic, each insert going through
    `createNotificationIfNotExists`:
    - Birthdays/anniversaries: `getBirthdaysThisWeek()`/`getAnniversariesThisWeek()` (Stage 5,
      unchanged) filtered to `daysUntil === 0` (today only, not the whole week, so the owner isn't
      re-notified every day for the same upcoming birthday).
    - **Inactive-threshold "just crossed" approximation** (documented in full in the route's own
      doc comment too): the schema has no stored "last known inactivity tier," so there's no exact
      way to detect the moment a customer crosses 30/60/90 days inactive. Approximated by only
      notifying customers whose `daysSinceLastVisit` falls in `[tier, tier + 2]` (e.g. `[30, 32]`)
      — narrow enough that a daily cron run catches the crossing without re-notifying someone who's
      been inactive for months, wide enough to tolerate a missed day or two of cron execution.
      **This is a documented approximation, not exact crossing-detection** — an exact version would
      need a stored per-customer "last notified tier" field (a schema change, out of scope).
    - **VIP/top-spender simplification** (also documented inline): every customer currently in
      `getTopSpenders(10)` (Stage 5, unchanged) gets a `vip-top10:<id>` notification attempt each
      run — there's no historical top-10 snapshot to detect "newly entered," so the 24h dedupe
      window is what actually prevents daily spam once a customer settles into the top 10, not any
      "just entered" logic. A true newly-entered detection is out of scope per the brief.
  - `components/notifications/NotificationBell.tsx` — bell icon + unread-count badge (`bg-danger`
    pill, "9+" past 9), a shadcn `dropdown-menu` (base-ui `Menu` under the hood — no `asChild` prop
    exists on `DropdownMenuTrigger`, base-ui uses a `render` prop instead per Stage 1's own notes;
    since `MenuPrimitive.Trigger` already renders a native `<button>`, className/children are
    passed directly rather than wrapping in a second nested `<button>`) listing recent
    notifications (icon varies by `type` prefix — 🎉/❤️/⭐/⚠️/🔔), unread ones visually distinguished
    (accent-tinted background + a small accent dot), "Mark all read" in the header. **Deep-link
    scheme:** since every notification's `type` this stage's cron route creates is
    `"<kind>:<customerId>"`, `linkForNotification` splits on the first `:` and links straight to
    `/customers/[id]`; falls back to `/lists` only if a `type` doesn't contain a `:` (defensive,
    doesn't happen with this stage's own cron route, kept for forward-compatibility per the
    brief's "your call" on this point). Clicking an unread row also marks it read (optimistic local
    update + `PATCH`). Fetches once on mount (via a `void`-called nested async function, the same
    cancellation-flag pattern `SendMessageSheet.tsx` established, to satisfy
    `react-hooks/set-state-in-effect`) and again every time the dropdown opens. Mounted in
    `Sidebar.tsx`'s header row (desktop) and in `BottomTabBar.tsx`'s "More" sheet header (mobile,
    next to the "More" title — chosen over crowding a 7th icon into the already-6-icon tab row).
  - `vercel.json` — new file, `{ "crons": [{ "path": "/api/cron/daily-check", "schedule": "30 2 * * *" }] }`.
    `30 2 * * *` UTC = 08:00 IST (UTC+5:30) daily — Vercel Cron schedules are UTC-only, no timezone
    field, so the conversion is baked into the cron string itself. Not exercised against real
    Vercel Cron (can't be, locally) — verified instead via direct `curl` against the route (below).

- **`middleware.ts` matcher extended** (the one Stage 1–7 file touched beyond pure additive
  reuse, and necessarily so): the existing matcher (`"/((?!api/auth|_next/static|_next/image|
  favicon.ico).*)"`) protected literally everything else, including `/api/cron/daily-check` — a
  cron request has no session cookie, so it was hitting the "redirect unauthenticated to /login"
  branch (a `307`) *before* the route handler's own `CRON_SECRET` check ever ran, meaning a wrong
  or missing `Authorization` header returned `307` instead of the intended `401`. Fixed by adding
  `api/cron` to the negative-lookahead exclusion, exactly parallel to how `api/auth` was already
  excluded for the same reason (NextAuth's own routes also don't go through session middleware).
  Documented inline in `middleware.ts` itself as well.

**Why / deviations:**
- The `middleware.ts` matcher change was necessary, not optional — without it the cron route's own
  auth check is unreachable and the 401-on-bad-secret acceptance criterion is impossible to satisfy.
- `shouldFilter={false}` on cmdk's `Command` and the `SelectValue` children-as-function fix are
  both small but easy-to-miss base-ui/cmdk defaults that don't surface as `tsc`/`eslint` errors —
  documented above so they aren't re-discovered by trial and error again.
- No other deviations of substance — filters, search, and notifications all extend existing Stage
  4/5 query functions rather than duplicating or reshaping them, per the brief's constraints.

**Verification:**
- `npx tsc --noEmit` — clean. `npx eslint .` — clean (one pre-existing unrelated warning in
  `lib/whatsapp/cloud-mode.ts` from Stage 6, unchanged). `npm run build` — compiles successfully,
  all new routes (`/api/search`, `/api/notifications`, `/api/cron/daily-check`) listed as dynamic
  (`ƒ`) functions in the route summary.
- `npm run dev` + a mix of authenticated `curl` (NextAuth credentials-callback cookie jar, same
  approach every prior stage used) and Playwright browser automation, logged in as
  `owner@kangnabeauty.in` / `password123`:
  - **Command palette:** `GET /api/search?q=priya` → one match (Priya Sharma). In-browser: pressed
    ⌘K, typed "priya", palette showed "Priya Sharma · 9800001234 · 22 Jul 2026", clicked it →
    navigated to `/customers/[Priya's id]` correctly.
  - **Customer filters, cross-checked against independent raw Prisma queries** (throwaway
    `scripts-tmp-verify-filters.ts`, deleted after use): `category=Skincare` → 7 via
    `getAllCustomers` vs. 7 via raw `favouriteCategory: "Skincare"` query, **match**;
    `minSpend=20000&maxSpend=60000` → 15 vs. 15, **match**; `visitFrequency=6+` → 10 vs. 10 (raw
    `totalVisits: {gte: 6}`), **match**; combined `category=Skincare&visitFrequency=1` → 1 result
    (Nisha Malhotra) — confirmed in-browser too (`/customers?category=Skincare&visitFrequency=1`
    rendered exactly that one customer card). In-browser: opened the Filters sheet, entered
    `minSpend=50000`, clicked Apply → URL became `/customers?minSpend=50000`, list correctly
    narrowed from 27 to 7 customers (all ≥₹50,000 spend), "Filters" button showed a "1" badge,
    reloaded the page directly at that URL → same 7 customers persisted (confirms server-side
    `searchParams`-driven filtering survives a real reload, not just client navigation). No console
    errors/warnings on any of the above.
  - **Cron route — the double-curl dedupe test (the specific acceptance criterion):**
    - `OwnerNotification` count **before**: **0**.
    - Missing `Authorization` header → **401**. Wrong secret (`Bearer wrongsecret`) → **401**.
    - **First run** (`curl -H "Authorization: Bearer <real CRON_SECRET from .env>" .../api/cron/daily-check`)
      → `{"ok":true,"created":14,"skipped":0,...}`. `OwnerNotification` count **after run 1: 14**
      (0 birthdays/anniversaries today — consistent with Stage 7's log for 2026-07-22; 4
      inactive-threshold customers: Ritu Kapoor 30d, Sanjay Joshi 31d, Suresh Iyer 60d, Meera Rao
      90d, each exactly within their tier's `[tier, tier+2]` window; 10 top-spender VIP alerts).
    - **Second run, exact same curl command** → `{"ok":true,"created":0,"skipped":14,...}`.
      `OwnerNotification` count **after run 2: 14** (unchanged) — **dedupe confirmed: 0 new rows
      on the identical second run.**
  - `GET /api/notifications` → all 14 rows. `PATCH { all: true }` → `{"ok":true,"count":14}`,
    independently re-queried the DB afterward — all 14 rows had `isRead: true`.
  - **NotificationBell, in-browser:** flipped one notification back to `isRead: false` directly in
    the DB (throwaway script) to get a clean single-unread state, reloaded `/` — the bell showed
    "Notifications (1 unread)" with a "1" badge, matching the DB exactly. Clicked the bell → dropdown
    opened showing all 14 notifications (correct messages, relative timestamps via
    `date-fns`'s `formatDistanceToNow`, each linking to the right `/customers/[id]`). Clicked "Mark
    all read" → re-queried the DB directly afterward: **unread count 0**, confirming the click
    persisted to the database, not just local UI state.
  - All throwaway verification scripts (`scripts-tmp-verify-filters.ts`,
    `scripts-tmp-count-notif.ts`, `scripts-tmp-show-notif.ts`, `scripts-tmp-unread-one.ts`,
    `scripts-tmp-check-read.ts`) deleted after use, matching every prior stage's convention.
  - Dev server stopped after verification (`pkill -f "next dev"`).

## Stage 9 — Settings

- **UserManagementTable** (`components/settings/UserManagementTable.tsx`): client component consuming
  the pre-built `app/api/settings/users/route.ts` contract. Table lists Name/Email/Role
  (`AppleBadge`, vip for OWNER, neutral for STAFF)/Created/Actions; per-row "Make Owner"/"Make Staff"
  toggle (PATCH) and "Delete" (DELETE, gated behind `window.confirm`), both disabled on the row
  matching `useSession()`'s `session.user.id` (server already blocks self-demote/self-delete —
  this is belt-and-suspenders). "Add User" opens an `AppleSheet` with a `react-hook-form` +
  `zodResolver(createUserSchema)` form (Name/Email/Password/Role select, defaulting STAFF); a 409
  duplicate-email response is surfaced as an inline field error via `setError("email", ...)`, not
  just a toast. All mutations toast success/failure. On add-success the sheet closes and the list is
  refetched from `GET /api/settings/users` (simplest way to reflect server truth, per the task brief).
  - Verified in isolation via a temp scratch page (`app/(app)/verify-users-temp/page.tsx`, deleted
    before finishing — used a *new* file rather than editing the shared `app/(app)/page.tsx` directly,
    since other agents were concurrently editing that file's temp verification blocks in parallel;
    editing it directly was in fact blocked by the permission system in this run). Logged in as
    `owner@kangnabeauty.in`: added a STAFF user via the sheet (appeared in list, success toast);
    submitted the same email again (409) → inline "A user with this email already exists" error
    rendered under the Email field, sheet stayed open, no crash; toggled the test user's role
    OWNER→STAFF→OWNER via the row button (toast + persisted, re-queried `GET
    /api/settings/users` to confirm); deleted the test user via the API path the Delete button
    calls (200 `{ok:true}`, confirmed removed from a follow-up `GET`). Confirmed the OWNER's own
    row renders both action buttons `disabled`.
  - `npx tsc --noEmit` and `npx eslint components/settings/UserManagementTable.tsx` both clean (two
    pre-existing unrelated errors remain in the repo from other in-progress files —
    `app/api/auth/[...nextauth]/route.ts` and `components/settings/StoreProfileForm.tsx` — not
    touched by this component).
  - Dev environment note: this stage's dev server was shared with other parallel agents working the
    same repo simultaneously (concurrent HMR reloads, tab hijacking, a couple of transient
    `ERR_CONNECTION_REFUSED` restarts). Left the shared `next dev` instance running at the end
    rather than killing it, since other agents' sessions were actively depending on it.

**Note (ThresholdsForm):** Built `components/settings/ThresholdsForm.tsx` — a client component
(`react-hook-form` + `zodResolver(thresholdsSchema)`) with three number inputs ("Inactive after
(days) — Level 1/2/3", pre-filled from `defaultValues`), PATCHing `/api/settings/thresholds` on
submit with `sonner` toast success/failure and inline field errors, matching the
`StoreProfileForm.tsx` pattern already established in this file (fetch + toast, no custom result
type). Includes a brief, non-apologetic caption at the top of the form stating these values are
stored for reference/future use and that Lists/dashboard/WhatsApp "We Miss You" still use fixed
30/60/90-day tiers.

- **Deviation — `z.coerce.number()` typing:** `thresholdsSchema`'s fields use `z.coerce.number()`,
  whose zod "input" type is `unknown`, not `string` — plugging it straight into
  `useForm<ThresholdsInput>()` fails `tsc` (`Resolver<...unknown...>` not assignable). Fixed with
  the same `z.input`/output 3-generic `useForm` split `CustomerForm.tsx` already uses for its own
  transform-based schema (`useForm<z.input<typeof thresholdsSchema>, unknown, ThresholdsInput>`) —
  no changes to `lib/validations/settings.ts` itself were needed or made.
- **Verification:** `npx tsc --noEmit` and `npx eslint .` clean on `ThresholdsForm.tsx` (pre-existing
  errors in `app/api/auth/[...nextauth]/route.ts`, `AddBillForm.tsx`, and `StoreProfileForm.tsx`
  were already present before this change and are out of scope). Verified in isolation by
  temporarily rendering `ThresholdsForm` on `app/(app)/page.tsx` (a parallel agent was concurrently
  adding their own `CategoryManager` temp block to the same file at the same time — coordinated by
  only touching/reverting my own import and JSX block, leaving their `getSettings()` wiring and
  block intact) — logged in as `owner@kangnabeauty.in`, edited all three fields (30/60/90 →
  25/55/95), saved, reloaded `/`, and confirmed via a direct DOM read of the inputs that the new
  values persisted server-side. Tested the validation-failure path via a direct
  `fetch("/api/settings/thresholds", {method:"PATCH", body:{inactiveThreshold30:-5,...}})` call
  (UI state was unreliable mid-test due to the concurrent file edits triggering Fast Refresh) —
  confirmed the API correctly 400s ("Too small: expected number to be >0") and the component's
  `if (!res.ok) toast.error(...)` path handles that without crashing. Reset the settings row back
  to 30/60/90 via the API and fully reverted the temp scratch JSX/import from
  `app/(app)/page.tsx` before finishing (left the shared `getSettings()` fetch and the other
  agent's `CategoryManager` import/block in place, since removing them would have broken their
  concurrent work). Dev server stopped after verification.

**Note (CategoryManager + AddBillForm live categories):** Built
`components/settings/CategoryManager.tsx` — a client component with an in-place-editable list
(`Input` per row, no separate edit mode), per-row up/down reorder buttons (disabled at the ends,
no drag-and-drop), an "X" remove button, an "Add Category" button appending a blank row, and a
"Save Categories" button that trims/filters blanks and PATCHes `/api/settings/categories`. On a
400, pulls the first message out of `json.issues.properties.categories.errors[0]` (falling back
to `json.error`) and shows it both inline and via `toast.error`; success re-syncs local state from
the response and shows `toast.success`. Matches `StoreProfileForm.tsx`'s fetch+toast pattern.

Wired `components/bills/AddBillForm.tsx` to fetch the live list: a `useEffect(() => { fetch(...) }, [])`
on mount populates `liveCategories` (real async data-fetch-then-setState, not the mount-detection
antipattern `react-hooks/set-state-in-effect` blocks — confirmed clean via `npx eslint`).
`categoryOptions` is `liveCategories ?? [...BILL_CATEGORIES]` (spread needed — `BILL_CATEGORIES` is
a `readonly` literal-union tuple via `as const`, which doesn't structurally unify with `string[]`
for `.includes()` without widening, a `tsc` error caught during verification). The previously-select
category is never left dangling: `selectedCategory = categoryOptions.includes(category) ?
category : categoryOptions[0]` is computed as **derived state each render** (not a second
`useEffect` syncing `category` from `categoryOptions`) — deliberately chosen since a "reset state
if props/derived value changed" effect is exactly the pattern that class of eslint rule exists to
push people away from; the derived value covers both the initial-render (fallback list) case and
the moment the live list arrives and the old default (e.g. fallback's first item) isn't in it.
Fallback `BILL_CATEGORIES` import was kept as required, unused only when the live fetch succeeds
with a non-empty array.

- **Verification:** `npx tsc --noEmit` and `npx eslint .` clean on both new/touched files (repo-wide
  `npx eslint .` had zero errors, one pre-existing unrelated warning in `lib/whatsapp/cloud-mode.ts`;
  `tsc --noEmit`'s remaining errors are all pre-existing/out-of-scope — `app/api/auth/[...nextauth]/route.ts`
  and `components/settings/StoreProfileForm.tsx`). Isolation-tested `CategoryManager` by temporarily
  wiring it into `app/(app)/page.tsx` (import + a TEMP `AppleCard` block below the other agents' — by
  the time this ran, both the ThresholdsForm and Users scratch blocks had already been reverted by
  their respective agents) — logged in as `owner@kangnabeauty.in`. The shared dev server + browser
  session were being actively driven by other parallel agents at the same time (tab navigations
  jumping to `/verify-users-temp` mid-script, a full `next dev` outage caused by this session
  accidentally killing the shared server's parent process when cleaning up a stray background
  instance it had spawned — immediately restarted via `npm run dev` in the background, confirmed
  back up via `curl`/`GET /api/settings/categories` before continuing). Because of that churn,
  interactive UI verification was anchored on deterministic `curl` calls against a real
  cookie-authenticated session (logged in via `/api/auth/callback/credentials`) rather than relying
  solely on browser automation: `PATCH /api/settings/categories` with a reordered list plus a new
  `"Verification Test Category"` entry → 200 with the new array; a follow-up `GET` confirmed
  persistence; a deliberately-duplicate `["Foo","foo"]` PATCH → 400 with
  `{error:"Validation failed", issues:{properties:{categories:{errors:["Category names must be
  unique"]}}}}`, confirming `CategoryManager`'s error-path parsing targets the right shape. Also
  confirmed via the DOM (`document.querySelectorAll`) that `CategoryManager`'s "Add Category" button
  appends an editable blank row. For `AddBillForm`: opened the global Add Bill sheet, searched
  "Priya", selected the customer, opened the Category `<Select>` — its options exactly matched the
  live (curl-PATCHed) list in the live order, including the added `"Verification Test Category"`
  entry and reordered `"Other"` — proving the dropdown is reading `GET /api/settings/categories`,
  not the static `BILL_CATEGORIES` fallback. Reset categories back to the schema-default order via
  a final `curl PATCH` and fully reverted the temp `CategoryManager` import/JSX from
  `app/(app)/page.tsx` before finishing. Left the shared `next dev` instance running (restarted, per
  above) since other agents' sessions were still depending on it.

**Note (final integration — `app/(app)/settings/page.tsx` + `SettingsTabs`):** Assembled the pieces
above into the actual Settings page, the last piece of Stage 9.

- `app/(app)/settings/page.tsx` — Server Component. Calls `auth()` for the current session/role,
  `getSettings()` unconditionally, and `prisma.user.findMany({select:{...}})` (explicitly excluding
  `password`) only when `session.user.role === "OWNER"` — STAFF gets an empty `initialUsers` array
  rather than a wasted fetch, since `SettingsTabs` hides that tab for them anyway. Passes everything
  down to a new client component.
- `components/settings/SettingsTabs.tsx` (new) — thin `"use client"` wrapper around Stage 1's
  `SegmentedControl`, matching `CustomerProfileTabs`' established tab-switcher convention (not
  shadcn's `tabs`, despite it being installed). Options: Store Profile / Categories / Thresholds /
  Users / Export. The **Users** option is filtered out of the options array entirely for STAFF
  viewers (`options.filter(opt => opt.value !== "users")`) rather than shown-with-a-gate — chosen
  per the brief's own preference, and trivial given `SegmentedControl`'s plain options-array API. (An
  `EmptyState` "Owner access required" fallback is still wired for the `tab === "users" && !isOwner`
  branch as a defensive belt-and-suspenders in case that filtering logic is ever bypassed, but it's
  unreachable in normal use since the tab option itself is gone.) Export tab is two `<a
  download href="/api/export/{customers,bills}">` links styled to match `AppleButton`'s primary
  variant (not actual `AppleButton`s, since that component renders a `motion.button`, not an anchor,
  and these need to be real downloadable links).
- **Deviation — fixed two pre-existing `tsc` errors left open by earlier Stage 9 sub-agents** (both
  previously logged as "pre-existing/out of scope" for component-only agents, but this is the final
  integration pass, so both were fixed here):
  - `app/api/auth/[...nextauth]/route.ts`'s `HEAD` handler took a plain `Request`, but
    `handlers.GET` (from Stage 10's `lib/auth.ts`) expects a `NextRequest`. Fixed by typing the
    parameter as `NextRequest` (imported from `next/server`) instead — a one-line, no-behavior-change
    fix.
  - `components/settings/StoreProfileForm.tsx` used `useForm<StoreProfileInput>()` (single generic),
    but `storeProfileSchema`'s `logoUrl` field is a `.transform()` whose zod "input" type (raw form
    string) differs from its "output" type (`StoreProfileInput`, post-transform) — the same class of
    mismatch `ThresholdsForm.tsx` and `CustomerForm.tsx` already solved with the `z.input`/output
    3-generic `useForm` split. Applied the identical fix here
    (`useForm<z.input<typeof storeProfileSchema>, unknown, StoreProfileInput>`).
- **Real bug found and fixed during end-to-end browser verification (not just a typing issue):**
  `storeProfileSchema` (`lib/validations/settings.ts`) is parsed on **both** sides of the store
  profile's round trip — `StoreProfileForm`'s `zodResolver` parses the raw form values and produces
  the transformed `{logoUrl: string | null}` output for its `onSubmit` payload, and
  `PATCH /api/settings/store` parses that *already-transformed* request body through the *same*
  schema again. The schema's `logoUrl` field only accepted `""` or `undefined` as valid input (not
  `null`), so every save with a blank Logo URL field 400'd at the API — caught live while running
  this stage's own required "edit + save store profile, reload, confirm persisted" verification
  step, not by inspection. Fixed by widening the union to also accept `z.null()` on input,
  transforming all three (`""`/`undefined`/`null`) to `null` on output. This wasn't one of the four
  frozen settings *components* (`lib/validations/settings.ts` is a shared schema file, not a
  component), so it was in scope to fix, and doing so was necessary to make Stage 9 actually work
  end-to-end rather than just type-check.

**Verification (final integration pass):**
- `npx tsc --noEmit` — clean across the **whole project**, zero errors (previously 2 pre-existing
  errors in `app/api/auth/[...nextauth]/route.ts` and `StoreProfileForm.tsx`, both fixed above).
- `npx eslint .` — clean, 0 errors (2 pre-existing warnings remain, both unrelated to this stage:
  an unused `settings` var in `app/(app)/page.tsx` and an unused `_params` in
  `lib/whatsapp/cloud-mode.ts`, neither touched by this pass).
- `npm run build` — full production build succeeds; `/settings` compiles as a dynamic (`ƒ`) route
  alongside every other route in the app, zero warnings/errors, first full-project build run at the
  end of the entire planned build.
- `npm run dev` + Playwright, logged in as `owner@kangnabeauty.in` / `password123`, `/settings`:
  - All 5 tabs render (Store Profile/Categories/Thresholds/Users/Export) for the OWNER session.
  - **Store Profile:** edited Store Name → "Kangna Beauty & Jewellery Studio" and Accent Color →
    `#FF2D55`, saved — first attempt hit the `logoUrl`-transform 400 bug described above (caught
    live, fixed, retried) — second attempt succeeded (200), reload confirmed persistence. Reset both
    fields back to their original defaults (`Kangna Beauty & Jewellery` / `#0A84FF`) afterward.
  - **Categories:** added "Bridal Package" via "Add Category" + "Save Categories" → 200, reload
    confirmed persistence (left in place — the task's own instructions treat this as a real,
    non-throwaway addition meant to flow into the next check).
  - **Cross-stage link:** opened the global "Add Bill" sheet (Sidebar or `/customers`), searched
    "priya", selected Priya Sharma, opened the Category `<Select>` — "Bridal Package" appeared as
    the last option in the live dropdown, confirming `AddBillForm` reads `GET
    /api/settings/categories` live rather than the static `BILL_CATEGORIES` fallback. Closed the
    sheet without submitting (no test bill created).
  - **Thresholds:** edited 30/60/90 → 25/55/95, saved (200), reload confirmed persistence; reset
    back to 30/60/90 and reload-confirmed the reset too.
  - **Users:** confirmed the seeded OWNER (`Kangna Store Owner`) row renders with both action
    buttons disabled (own row). Added a test STAFF user (`Test Staff Member`,
    `test-staff-stage9@kangnabeauty.in`) via "Add User" — appeared in the table immediately with
    "Make Owner"/"Delete" both enabled. Deleted the same test user via its row's "Delete" button
    (confirmed the `window.confirm` dialog, toast "Test Staff Member was removed."); a direct
    Prisma query afterward confirmed only the original seeded OWNER row remains in `User`.
  - **Export:** clicked into the Export tab, confirmed both links render with the correct
    `href`/`download` attributes; `curl`-downloaded both CSVs with a STAFF session cookie (STAFF
    *is* allowed to hit `GET /api/export/*` — that's unrelated to the Settings-page Users-tab
    gating) and confirmed: `customers-*.csv` header row present, 27 data rows; `bills-*.csv` header
    row present, 115 data rows — both counts independently confirmed against `prisma.customer.count()`
    (27) and `prisma.bill.count()` (115) via a throwaway script, deleted after use.
  - **STAFF role-gating (both halves):** logged in as the test STAFF user via the credentials
    callback (`curl`, cookie jar) and confirmed `GET /api/auth/session` returned
    `role: "STAFF"`; `PATCH /api/settings/users` with that session → **403** (server-side gating,
    already built by an earlier stage, reconfirmed here). Separately fetched `GET /settings` with
    the same STAFF cookie and grepped the rendered tab list: exactly `Store Profile`, `Categories`,
    `Thresholds`, `Export` render — **no `Users` tab** in the STAFF-rendered HTML (the only "Users"
    match in the raw response was the RSC data payload's `initialUsers":[]` prop, not a rendered tab
    label), confirming the page-level hiding works end-to-end, not just via the client-side filter
    logic in isolation.
  - No unexpected console errors during any of the above (the one 400 from the `logoUrl` bug
    investigation was an expected, correctly-surfaced application error, not a silent failure).
  - Dev server stopped after verification (`pkill -f "next dev"`); all throwaway verification
    scripts (`scripts-tmp-count-check.mjs`) and scratch cookie jars/CSV downloads were deleted.

**Deviations summary for this pass:** two pre-existing `tsc` errors fixed (both trivial, described
above), one real cross-cutting validation bug found and fixed in `lib/validations/settings.ts`
(`logoUrl` null-handling). No changes were made to any of the four frozen settings components' props,
`prisma/schema.prisma`, `.env*`, or any existing API route's behavior (the `nextauth` route fix only
changes a parameter's static type, not runtime behavior).

This completes the planned build (Stages 0-10). All phases from the original spec are implemented:
design system, schema, auth, customers, billing, automatic lists, dashboard, WhatsApp messaging
(link-mode), search/notifications, and settings.

---

## Stage 11 — E2E Testing: Auth, Customers, Billing

**Prompt/request:** Full end-to-end QA pass over Auth, Customer Management, and Billing/Rollups —
both the UI (Playwright) and the API routes directly (curl with a real session cookie) — with full
authority to fix any bugs found, re-verify, and leave the DB in its original ~27-customer/115-bill
seeded state.

**Pre-flight:** `npx tsc --noEmit` and `npx eslint .` were both clean before starting (2 pre-existing
unrelated warnings only, matching Stage 9's documented final state) — nothing was already broken.

**Bugs found and fixed:**

1. **Unauthenticated API requests returned a 307 HTML redirect to `/login`, not a 401** —
   `middleware.ts`'s (see rename below) catch-all matcher protects `/api/*` the same way it protects
   pages: on no session, it always issued `NextResponse.redirect("/login")`. For a page this is the
   right UX; for a `fetch()`/`curl` caller hitting e.g. `POST /api/customers` with no cookie, this
   meant silently receiving the login page's HTML with a `307` instead of a machine-readable `401` —
   exactly the acceptance criterion Stage 10's own brief called for and apparently was never
   actually tested end-to-end. **Fix:** in the unauthenticated branch, check
   `pathname.startsWith("/api/")` first and return `NextResponse.json({error:"Unauthorized"}, {status:401})`
   for API routes, keeping the redirect-to-`/login` behavior for page routes. **Verified:** `curl -X
   POST /api/customers` with no cookie now returns `401 {"error":"Unauthorized"}`; an authenticated
   request to the same route still succeeds; `GET /` unauthenticated still `307`s to `/login`; `GET
   /login` while already authenticated still `307`s to `/`.

2. **`/customers/[id]`'s `notFound()` returned HTTP `200`, not `404`, for a nonexistent customer id**
   — root-caused to Stage 7's `app/(app)/loading.tsx`: a `loading.tsx` file at that layout level
   makes Next.js automatically wrap *every* nested route under `(app)` (dashboard, customers, lists,
   messages, settings) in a Suspense boundary for the initial document request, which means the
   response headers commit to `200` and streaming begins as soon as the loading skeleton flushes —
   *before* the page component's own `await getCustomerById(id)` / `notFound()` call has even run.
   This is documented, expected Next.js 16 streaming behavior (confirmed by reading
   `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`'s "Status
   Codes" section: "the response body starts streaming when a Suspense fallback renders... ensure the
   resource exists before the response body is streamed"), not a bug in `notFound()` itself or in
   `app/(app)/customers/[id]/page.tsx`'s own logic. A genuinely nonexistent route (no
   `notFound()` involved) correctly returned a real `404` throughout, confirming this was specific to
   pages nested under the loading-wrapped layout. **Fix:** moved the dashboard route into its own
   nested route group, `app/(app)/(dashboard)/page.tsx` + `app/(app)/(dashboard)/loading.tsx` (route
   groups don't affect the URL — `/` is unaffected), so the Suspense-inducing `loading.tsx` only
   wraps the dashboard route, which never calls `notFound()`, while `/customers/[id]`, `/lists`,
   `/messages/*`, and `/settings` are no longer wrapped and render fully before headers are sent.
   **Verified:** `curl` and Playwright (`page.goto`) both confirm `GET /customers/nonexistent-id-123`
   now returns a real `404` status with the correct "This page could not be found" UI; the dashboard
   (`/`) still renders correctly with its skeleton loading state intact; `rm -rf .next` + fresh
   `npx tsc --noEmit` / `npx eslint .` / `npm run build` all clean after the move.

3. **(Deprecation, not a functional bug, fixed while already in `middleware.ts`)** — `npm run build`
   emitted `The "middleware" file convention is deprecated. Please use "proxy" instead.` Confirmed via
   `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` that Next.js 16
   renamed the `middleware.ts` file convention to `proxy.ts` (same API — a default- or
   `proxy`-named-exported function plus the same `config.matcher` export; this file already used a
   default export, so no code changes were needed, only the rename). The official codemod
   (`npx @next/codemod@canary middleware-to-proxy .`) refused to run against the repo's uncommitted
   working tree (by design, as a safety check) rather than force it with `--force` against
   uncommitted changes, so the rename was done directly: `mv middleware.ts proxy.ts`. **Verified:**
   `npm run build` output no longer shows the deprecation warning (route summary line changed from
   silence to a clean `ƒ Proxy (Middleware)` line); re-ran the full auth verification suite (login,
   unauthenticated 401/307s, authenticated dashboard/customer 404) against the renamed file — all
   still pass identically.

**Auth — verified, no other bugs found:**
- Correct login → `/`; sign-out → `/login` with session cookie cleared.
- Wrong password, nonexistent email, empty form, and a SQL-injection-shaped email
  (`' OR '1'='1`) all correctly fall through to NextAuth's generic `null` session / `302` redirect —
  no crash, no bypass, no distinguishing error message (Prisma's parameterized queries make classic
  SQLi structurally impossible here regardless).
- `/login` while already authenticated → `307` to `/` (not a "shows the form uselessly" case).
- Session persists across reload (JWT-strategy cookie, confirmed by restarting the dev server
  entirely mid-session and re-checking `/api/auth/session` with the same cookie jar — still valid).
- Unauthenticated hit on a protected page → `307` to `/login`; unauthenticated hit on a mutating API
  route → `401` (bug #1 above, now fixed).

**Customers — verified, plus bug #2 above:**
- Full-field create, minimal-field create, edit, profile view, list view, Quick Add — all work via
  both API and UI (Playwright).
- Mobile number validation (`^[6-9]\d{9}$`) correctly rejects: too short, too long, non-numeric,
  invalid leading digit, and leading/trailing whitespace (the regex has no untrimmed-input
  workaround, so whitespace fails cleanly rather than being silently trimmed) — all `400`s with a
  clear message, no crash.
- Duplicate mobile number on **create**: `409` with `existingCustomerId` + working "View their
  profile" link (API and Quick Add Sheet UI both verified).
- Duplicate mobile number on **edit** (PATCHing customer A to customer B's mobile): also correctly
  `409`s with no partial write — confirmed the target customer's mobile was unchanged after the
  failed attempt. This specific path wasn't called out as tested in any prior stage's log; now is.
- Name field: empty string → `400`; a 5000-character string → accepted (no max-length constraint in
  `customerSchema`, consistent with the brief not specifying one) and renders on both the list and
  profile pages without breaking layout or crashing; a `<script>alert(1)</script>` name is stored
  as-is and rendered **safely escaped** everywhere checked (`/customers` list, `/customers/[id]`
  profile) — confirmed via raw HTML inspection (`&lt;script&gt;...&lt;/script&gt;`, zero literal
  `<script>` tags in the served HTML) and a full-navigation Playwright load with zero console errors.
  Grepped the whole project for `dangerouslySetInnerHTML` — **zero matches**, confirming there is no
  raw-HTML-injection surface anywhere in the app.
- Birthday/anniversary: future date (`2099`), absurd past (`1800`) and absurd future (`3000`) dates,
  and blank/omitted dates are all accepted without validation error (no min/max-date constraint
  exists in `optionalDateSchema`, and the brief didn't ask for one) — all render safely on the
  profile page with no crash.
- `/customers/nonexistent-id-123` → clean `404` (bug #2, now fixed).
- Customer filter bar: category, visit-frequency, min/max spend, and last-visit date-range filters
  all correctly `AND`-combine (cross-checked combined-filter results against independent raw Prisma
  queries — exact match); an impossible range (`minSpend=100000&maxSpend=1`) returns an empty result
  set with no crash, confirmed in both `curl` and Playwright (zero console errors); URL params
  round-trip correctly on a direct reload (verified a 6-active-filter URL reloads to the identical
  filtered result set and the Filters button's badge count matches).

**Billing & Rollups — the most important area, verified extensively, zero bugs found:**
- Duplicate `billNo` on create: `409`, no crash, and — explicitly checked per the brief — the
  customer's rollup fields were confirmed byte-identical before and after the failed duplicate
  attempt (no partial write).
- Negative amount and zero amount: both `400` (`amountSchema` requires `> 0`). Non-numeric amount:
  `400`. Absurdly large amount (`99999999999`): accepted (no upper bound specified) and rollups
  compute correctly against it. Missing category: `400`. Nonexistent `customerId`: `404`.
- Future-dated bill and far-past-dated bill: both accepted; confirmed `lastVisitDate` correctly
  tracks the **maximum bill date**, not creation order — created a future-dated bill first, then an
  older-dated one, and `lastVisitDate` correctly stayed on the future date after the second (older)
  bill was added.
- `PATCH /api/bills/[id]` (amount + category + date) and `DELETE /api/bills/[id]`: both correctly
  trigger a full rollup recalculation, confirmed against hand-computed expected values.
- **Deleting a customer's last remaining bill** (not previously tested in any prior stage per Stage
  5's own MEMORY.md note about this being an unexercised edge case): confirmed all five rollup
  fields correctly reset — `totalVisits: 0`, `totalPurchaseAmount: 0`, `averageBillValue: 0`,
  `lastVisitDate: null`, `favouriteCategory: null`.
- **`favouriteCategory` tie-break-by-count**, deliberately constructed: two bills in category A
  (₹500 + ₹500 = ₹1000 summed, count 2) vs. one bill in category B (₹1000 summed, count 1) — an
  exact summed-amount tie. Result: category A won, confirming the tie-break-by-count logic in
  `recalculateCustomerRollup` genuinely works, not just handles the (much more common) no-tie case.
- **Rapid concurrent bill creation**: fired 4 `POST /api/bills` requests back-to-back (same
  `Promise`-parallel curl backgrounding, not sequential awaits) against one customer — all 4
  succeeded (`201`) and the resulting rollup (`totalVisits: 4`, correct summed total) shows no lost
  update / race condition, confirming the `$transaction`-wrapped recalculation Stage 4 built holds
  up under concurrent load.
- **Independent from-scratch rollup-consistency check** (throwaway script, its own plain-object
  category tally rather than reusing `recalculateCustomerRollup`'s logic, deleted after use): ran
  against **all** customers in the DB (not just ones touched during this pass) at two points — once
  mid-session with 35 customers (27 seeded + 8 test customers created during this stage's testing),
  once again after full cleanup with exactly 27 customers. **Zero diffs both times** across
  `totalVisits`, `totalPurchaseAmount`, `averageBillValue`, `lastVisitDate`, and `favouriteCategory`.
- **`AddBillGlobalSheet` search flows**, verified in-browser: searching a nonexistent name correctly
  shows "No customer found for '...'" with a working "Create New Customer" fallback (pre-filled with
  the searched name, verified the inline mini-form renders); partial name match (`"pri"` →
  exactly Priya Sharma) and digits-only mobile-number search both work via `GET
  /api/customers?q=`.

**Cleanup:** All 9 test customers created during this pass (edge-case names/dates, billing-rollup
test customers, tie-break test customer, one full-field registration) were deleted via a throwaway
script, along with their bills. One easy-to-miss leftover — a `TESTQA-DUP-1` bill added to the
*real* seeded customer Priya Sharma during the duplicate-`billNo` test — was caught by the
post-cleanup count check (`115` bills expected, `116` found) and removed; Priya Sharma's rollup was
confirmed to exactly match Stage 9's documented final state (3 visits, ₹32,462.61) afterward. Final
DB state: **27 customers, 115 bills, 1 user** — byte-identical to the state at the start of this
stage. All throwaway verification/cleanup scripts and the `.playwright-mcp` screenshot/log directory
were deleted before finishing.

**Verification:**
- `npx tsc --noEmit` — clean (including after the `(dashboard)` route-group move; required one
  `rm -rf .next` to clear a stale route-type cache, expected after moving a route file).
- `npx eslint .` — clean, same 2 pre-existing unrelated warnings as Stage 9's documented baseline
  (`app/(app)/(dashboard)/page.tsx`'s unused `settings` var — same warning, new file path after the
  move — and `lib/whatsapp/cloud-mode.ts`'s unused `_params`).
- `npm run build` — clean production build, all 26 routes compile, no deprecation warnings (the
  `proxy.ts` rename resolved the one that was present before this stage's fixes).
- Dev server stopped after verification (`pkill -f "next dev"`).

**Files changed:** `middleware.ts` → renamed to `proxy.ts` (content otherwise identical aside from
the new API-route-aware 401 branch); `app/(app)/page.tsx` + `app/(app)/loading.tsx` → moved to
`app/(app)/(dashboard)/page.tsx` + `app/(app)/(dashboard)/loading.tsx` (route group, URL unaffected,
no other content changes).

---

## Stage 11 — E2E Testing: Lists, Dashboard, Search & Notifications

**Prompt/request:** Full end-to-end QA pass over Automatic Lists, Dashboard, Global Search/Command
Palette, and Notifications & Cron — both the UI (Playwright) and the underlying query/API layer
directly (curl with a real session cookie, throwaway `tsx` verification scripts calling query
functions directly) — with full authority to fix any bugs found, re-verify, and leave the DB in its
original 27-customer/115-bill seeded state (plus the legitimate pre-existing cron-generated
`OwnerNotification` rows, left in place per this stage's own instructions).

**Pre-flight:** `npx tsc --noEmit` and `npx eslint .` were both clean before starting (same 2
pre-existing unrelated warnings as every prior stage's documented baseline — `app/(app)/(dashboard)/page.tsx`'s
unused `settings` var, `lib/whatsapp/cloud-mode.ts`'s unused `_params`) — nothing was already broken.
`proxy.ts`'s matcher (renamed from `middleware.ts` in the prior Stage 11 pass) already correctly
excludes `api/auth` and `api/cron`, and already returns a JSON 401 (not a redirect) for unauthenticated
`/api/*` requests — reconfirmed against `/api/notifications` and `/api/search` in this pass, both
generalize correctly.

**Bugs found and fixed:**

1. **Global search — literal `%`/`_` in a search query acted as unintended SQL `LIKE` wildcards,
   returning up to the result cap's worth of unrelated customers instead of zero/near-zero matches.**
   Root cause: `lib/queries/search.ts`'s `searchCustomers` and `lib/queries/customers.ts`'s
   `getAllCustomers({ q })` both pass the raw user query straight into Prisma's `contains` filter.
   On Postgres, Prisma compiles `contains` to `column ILIKE '%' || $1 || '%'` — the value is safely
   parameterized (no SQL-injection risk), but it is *not* escaped for `LIKE`'s own metacharacter
   syntax, so a literal `%` or `_` typed by the user is interpreted as a wildcard by Postgres itself.
   Confirmed live: `GET /api/search?q=%25` (URL-encoded `%`) returned 8 unrelated customers (the
   default result cap) instead of an empty/near-empty result; same for `q=_`. **Fix:** added
   `lib/queries/like-escape.ts` (`escapeLikeWildcards`, a new small shared file — not duplicated
   per-file, since both call sites are already server-only and importing `prisma`, so there's no
   client-bundle-size reason to duplicate the way `renderTemplate` was in Stage 6) that escapes `\`
   first, then `%` and `_`, before the value is handed to Prisma's `contains`. Applied in both
   `searchCustomers` and `getAllCustomers`'s `q` filter. **Verified:** `q=%` and `q=_` now both return
   `{"results":[]}` from `/api/search` and `0` customers from `/api/customers?q=`; normal searches
   (`q=priya`, `q=PrIyA`, a partial mobile-number fragment) are unaffected; `q='`, `q=\`, and
   `q=abc%def` all still return `200` with no crash/SQL error (Prisma's parameterization already made
   classic injection impossible regardless — this fix is about correctness of *matching*, not
   security).

2. **Command palette — a real, reproducible stale-response race condition**, exactly the UX bug class
   the task brief called out to check for, not just a theoretical risk. `components/search/CommandPalette.tsx`'s
   debounce (`useRef`-held `setTimeout`, cleared on every keystroke) only prevents new *timers* from
   stacking up — it does nothing once a debounced fetch is actually in flight. If a user types a short
   query, then quickly extends it before the first fetch resolves, network response order is not
   guaranteed to match request order; the earlier (shorter-query) fetch can resolve *after* the later
   one and silently overwrite the correct, current results with stale ones. **Confirmed via a Playwright
   route-interception test** (delayed the response for `q=p` by 2s, then quickly searched `priya`): the
   correct "Priya Sharma" result rendered first, then ~2s later was overwritten by the 8-result stale
   list for `q=p` — a real flash of wrong data, not hypothetical. **Fix:** added a monotonically
   increasing `latestRequestId` ref; each debounced fetch is tagged with the request id current at the
   time it was scheduled, and its response (`setResults`/`setLoading(false)`) is only applied if that id
   is still the most recently issued one when the response arrives. Also bumps the id on a
   cleared/empty query, so a still-in-flight fetch from a prior non-empty query can't repopulate
   results after the user cleared the search box. **Verified:** re-ran the identical delayed-route test
   after the fix — the correct "Priya Sharma" result now stays correct even after the slow `q=p`
   response arrives 2s later (no overwrite); normal typing, empty-query clearing, and the original
   "priya" click-through-to-profile flow all still work with zero console errors.

**Automatic Lists (`lib/queries/customer-lists.ts`) — verified extensively, zero logic bugs found:**
- All 5 segments render sensible data via `/lists` in-browser (Birthdays, Anniversaries, Inactive,
  Top Spenders, New This Month).
- **`daysUntil === 0` (birthday exactly today):** a synthetic customer with today's month/day (created
  matching the *real* app's date-storage convention — `customerSchema`'s `optionalDateSchema` does
  `new Date("YYYY-MM-DD")`, which parses as **UTC midnight** per the ISO 8601 spec, not local-timezone
  midnight; the dev machine's local timezone is IST/UTC+5:30, so a naive `new Date(y,m,d)` local
  constructor in a test script does *not* reproduce what the real form flow stores and initially gave
  a false-negative "bug" that was actually a test-script artifact, not an app bug — corrected the test
  to use `Date.UTC(...)` before concluding anything) was correctly returned with `daysUntil: 0` and
  sorted first. Also reconfirmed live against real seed data: Sunita Patel's birthday fell exactly
  today (2026-07-23) during this pass and rendered first in both `/lists?view=birthdays` and the
  dashboard's "Birthdays This Week" mini-list, labeled "Today".
- **Year-wraparound:** both a synthetic Dec 29 → Jan 2 case (`daysUntilNextOccurrence` returned the
  correct `4`, and the customer was correctly returned by `getBirthdaysThisWeek(fakeToday)`) and a
  real-relative-to-today +3-day case were verified correct.
- **`getInactiveCustomers` 30/60/90-day boundaries:** for all three tiers, a customer at *exactly* the
  threshold (`lastVisitDate` = `now - N days`, to the millisecond) was confirmed **excluded** (strict
  `>`, matching the documented behavior), and a customer 1 second past the threshold was confirmed
  **included** — the documented boundary behavior holds in practice, not just in the prior agent's
  claim. `lastVisitDate: null` customers were confirmed included and sorted before all dated entries
  (verified with a dedicated sort-order script against the live dataset, which already had 2 real
  never-visited customers from Stage 3/11's earlier testing, not just the synthetic one).
- **`getTopSpenders`:** a synthetic zero-spend customer was confirmed excluded; `limit=3` returned
  exactly 3 results in the correct descending order.
- **`getNewCustomersThisMonth` boundary:** a synthetic customer with `customerSince` = the last
  millisecond of last month was confirmed **excluded**; one with `customerSince` = the first instant of
  this month was confirmed **included**.
- **Malformed `?view=`/`?days=` query params:** `/lists?view=nonsense`, `/lists?days=999`, and
  `/lists?view=inactive&days=999` all returned `200` and degraded gracefully to the documented
  defaults (`view` falls back to `"birthdays"` via `isViewValue`'s type guard; `days` falls back to
  `30` since the page only accepts the literal strings `"60"`/`"90"`) — no crash, no 500, confirmed via
  both `curl` and reading `app/(app)/lists/page.tsx`'s own fallback logic.
- All synthetic `"ZZ Test ..."` customers created for the above were deleted immediately after each
  check; a final sweep confirmed none remained.

**Dashboard (`lib/queries/dashboard-stats.ts`) — verified extensively against raw Prisma queries,
zero bugs found:**
- Cross-checked 3 stat tiles not previously spot-checked in Stage 7's original build with independent
  raw aggregate queries, all exact matches: `repeatCustomerCount` (22 both ways), `totalSalesMonth`
  (₹1,06,574.30 both ways, cross-checked against a raw `Bill.aggregate` over the current calendar
  month), `storeAverageBillValue` (₹7,877.4874 both ways, total sum ÷ total count).
- **`getDailySalesLast30Days` zero-sales-day inclusion:** confirmed the 30-day window contains exactly
  30 consecutive calendar-day entries ending today with no gaps; found 19 genuinely zero-sales days in
  the current window and spot-checked one (`2026-06-24`) against a raw `Bill.aggregate` for that exact
  day, which returned `null` (zero bills), matching the chart's `0` entry — zero-sales days are
  included, not skipped. Also confirmed the sum of all 30 daily entries exactly matches a raw
  aggregate over the same 30-day window (₹1,19,963 both ways).
- **Today/This-Month toggle:** confirmed in-browser — both values are already server-fetched props
  (`getTotalSales("today")` and `getTotalSales("month")`, both computed in the same `getDashboardStats`
  call), so the toggle is a pure local `useState` flip with **no new network request** and therefore no
  possibility of showing stale data at a day boundary; toggling instantly updated ₹0 (today) ↔
  ₹1,06,574 (month) with no flicker or loading state.
- **Dark mode:** screenshotted the dashboard in both dark and light mode — the revenue area chart
  (line/gradient/axis labels/tooltip, via `var(--accent)`/`var(--border)`/`var(--muted-foreground)`
  CSS-variable theming from Stage 7) and the category donut + legend both stayed fully legible in
  both themes, no invisible text or vanishing chart colors.

**Global Search / Command Palette (`lib/queries/search.ts`, `app/api/search/route.ts`,
`components/search/CommandPalette.tsx`) — bugs #1 and #2 above, plus the following verified clean:**
- ⌘K opens the palette; searching "priya" returns exactly one match with correct name/mobile/last-visit
  formatting, clicking it navigates to `/customers/[id]` correctly, zero console errors.
- Mobile-number-fragment search (`q=80000123`, no full number) correctly matches Priya Sharma via the
  `mobileNumber` `contains` filter.
- Zero-character query: no request fires, no crash, empty suggestions list (verified both via a fresh
  `/api/search` call with no `q` at all and by opening the palette with an empty input in-browser).
- Zero-match query (`q=zzzznomatch`): `{"results":[]}`, no crash.
- Mixed-case query (`q=PrIyA`): case-insensitively matches Priya Sharma, confirming `mode: "insensitive"`
  works as intended.
- `GET /api/search` with no `q` param at all: `{"results":[]}`, `200`, no error — the route's own
  early-return for a missing/empty `q` (before ever touching the DB) handles this correctly.

**Notifications & Cron (`lib/queries/notifications.ts`, `app/api/notifications/route.ts`,
`app/api/cron/daily-check/route.ts`, `components/notifications/NotificationBell.tsx`) — verified,
zero bugs found:**
- **Dedupe re-verified after the middleware rename:** `GET /api/cron/daily-check` with no
  `Authorization` header → `401`; with `Authorization: Bearer wrongsecret` → `401`; with the real
  `CRON_SECRET` (read from `.env`, not modified) → `200`. Because this dev DB already carried 15
  legitimate, real cron-generated `OwnerNotification` rows from this same calendar day/the prior 24h
  (14 from Stage 8's original verification pass at `2026-07-22T18:05`, still within the 24h dedupe
  window, plus 1 real `birthday:<Sunita Patel>` row from earlier in this same session), running the
  real cron route twice back-to-back both times returned `{"created":0,"skipped":15}` — correctly
  deduped, consistent with the 24h-window design, but this dataset state meant the "0 created" runs
  didn't newly exercise the *creation* path. To directly re-verify `createNotificationIfNotExists`'s
  creation-then-dedupe logic (not just re-confirm a no-op), called it directly via a throwaway `tsx`
  script with a fresh, unique `type` string: **first call → `created: true`**, **second call (identical
  type, immediately after) → `created: false, reason: "duplicate"`**, row count for that type stayed at
  **exactly 1** — creation and dedupe both work correctly at the function level, not just "happens to
  no-op because everything already existed." Test row deleted immediately after.
- **Single-notification mark-read (`PATCH { id }`), not `{ all: true }`:** marked one specific unread
  notification (Sunita Patel's real today-birthday alert) via the API — response confirmed
  `isRead: true` for that row, and a follow-up `GET /api/notifications` confirmed the unread count
  dropped to exactly `0` (it was the only unread row at the time) with every other row's `isRead`
  state unchanged. Also directly verified via a throwaway script with two freshly-created test
  notifications that `markOneRead` flips only its target, leaving a sibling row untouched.
- **`GET /api/notifications` unauthenticated:** `401 {"error":"Unauthorized"}` — not a redirect,
  confirming the Stage 11 (Auth/Customers/Billing pass) middleware fix generalizes correctly to this
  route too, as the task specifically asked to re-check. Same for unauthenticated `PATCH`.
- **NotificationBell in-browser:** after the mark-one-read test above, the bell correctly showed no
  unread badge; opening the dropdown listed all notifications (read and unread) with correct
  relative timestamps, icons, and messages, matching the DB exactly.

**Cleanup:** All synthetic `"ZZ Test ..."` customers (13 total across the lists edge-case tests) and
`"zz-test-dedupe:..."` notification rows were deleted immediately after each check, not batched at the
end — confirmed via a final sweep script: **27 customers, 115 bills, 1 user**, zero `ZZ`-prefixed
customers, zero `zz-test`-typed notifications — byte-identical to the state at the start of this
stage. The 15 pre-existing cron-generated `OwnerNotification` rows (14 from Stage 8's original
verification + 1 real today-birthday alert) were deliberately left in place, per this stage's own
instructions, since they're legitimate cron output, not test pollution. All throwaway verification
scripts (`scripts-tmp-verify-lists.ts`, `scripts-tmp-verify-sort.ts`, `scripts-tmp-verify-dashboard.ts`,
`scripts-tmp-verify-notif.ts`, `scripts-tmp-check-baseline.ts`) were deleted before finishing.

**Verification:**
- `npx tsc --noEmit` — clean, both before and after all fixes.
- `npx eslint .` — clean, same 2 pre-existing unrelated warnings as every prior stage's documented
  baseline, nothing new introduced by this stage's fixes.
- `npm run build` — clean production build, all 26 routes compile (`ƒ Proxy (Middleware)` line
  present, no deprecation warnings).
- Dev server stopped after verification (`pkill -f "next dev"`).

**Files changed:** `lib/queries/like-escape.ts` (new — shared `escapeLikeWildcards` helper);
`lib/queries/search.ts` (applies the escape before `contains`); `lib/queries/customers.ts` (applies the
same escape to `getAllCustomers`'s `q` filter); `components/search/CommandPalette.tsx` (adds a
`latestRequestId` ref to guard against out-of-order/stale debounced search responses).

---

## Stage 11 — E2E Testing: WhatsApp Messaging & Settings

**Prompt/request:** Full end-to-end QA pass over WhatsApp Messaging and Settings — both the UI
(browser automation) and the underlying query/API layer directly (curl with a real session cookie,
throwaway `tsx` verification scripts) — with full authority to fix any bugs found, re-verify, and
leave the DB in its original 27-customer/115-bill/1-user/6-template seeded state.

**Pre-flight:** `npx tsc --noEmit` and `npx eslint .` were both clean before starting (same 2
pre-existing unrelated warnings as every prior stage's documented baseline). Per the task's own
instruction, grepped project-wide for `contains:` to check whether `lib/queries/customers.ts`'s
`getAllCustomers({q})` (already fixed for `%`/`_` wildcard-escaping in the prior Stage 11 pass) is
the only customer-search path: confirmed it is — `AddBillGlobalSheet`'s customer picker calls
`GET /api/customers?q=`, which routes through that same already-fixed `getAllCustomers`, and no
other `contains`-based query exists anywhere outside `lib/generated/prisma`'s doc comments. No new
un-escaped search path found; nothing to fix here.

**Bugs found and fixed:**

1. **A deactivated (`isActive: false`) `MessageTemplate` could still be used to send, via a direct
   API call, bypassing every UI guard.** `SendMessageSheet.tsx` correctly filters `GET /api/templates`
   down to `isActive` templates client-side before listing them, but neither
   `POST /api/messages/send` nor `POST /api/messages/bulk-send` re-checked `template.isActive`
   server-side — a `curl`/direct-`fetch` call with an inactive template's id sailed straight through
   and created a real `SENT` `MessageLog` row. Confirmed live: deactivated the seeded BIRTHDAY
   template via `PATCH /api/templates/[id]`, then `POST /api/messages/send` and
   `POST /api/messages/bulk-send` with that `templateId` both still returned `200`/`201` before the
   fix. **Fix:** both routes now look up the template first and return `400
   {"error":"This template is inactive"}` if `!template.isActive`, before ever calling
   `renderTemplate`/`sendMessage`. **Verified:** re-ran the identical direct-API calls after the fix —
   both now `400` with the inactive-template message; reactivated the template and confirmed sending
   resumed working normally; the pre-existing UI flow (`SendMessageSheet`) was unaffected (it never
   offers an inactive template as an option in the first place).

2. **The bulk campaign composer (`/messages/campaigns`) and the "We Miss You" panel both offered
   deactivated templates as selectable/default**, a UI-level instance of the same underlying gap as
   bug #1. `app/(app)/messages/campaigns/page.tsx` passed `getAllTemplates()` (all templates,
   active or not) straight into `CampaignBuilder`'s `<select>` and used
   `templates.find(t => t.type === "WE_MISS_YOU")` unfiltered as the `WeMissYouPanel`'s default
   template — so a deactivated template remained pickable in the campaign builder's dropdown and
   could still be the We-Miss-You panel's auto-selected template. Confirmed live: deactivated the
   ANNIVERSARY template, reloaded `/messages/campaigns` — it was still present in the template
   `<select>` (8 options instead of 7). **Fix:** added `const activeTemplates =
   templates.filter(t => t.isActive)` in the page and used it for both `CampaignBuilder`'s
   `templates` prop and the `weMissYouTemplate` lookup. **Verified:** reloaded after the fix — the
   deactivated template no longer appears in the dropdown (7 options); reactivated it afterward and
   confirmed it reappeared. This is on top of bug #1's server-side enforcement, which independently
   also blocks a bulk-send attempt against an inactive template even if the UI were somehow bypassed.

3. **Case-insensitive duplicate email addresses were not caught, on both user creation and login.**
   `app/api/settings/users/route.ts`'s `POST` handler pre-checks for an existing email via
   `prisma.user.findUnique({where:{email}})` — an exact-case lookup — before inserting, and
   `User.email`'s Postgres unique index is a plain (case-sensitive) btree, not `citext`. A case-variant
   of an existing email (e.g. `Owner@KangnaBeauty.in` vs. the seeded `owner@kangnabeauty.in`) sailed
   past both the app's own pre-check and the DB constraint, would have inserted as a second, confusing
   account, and `lib/auth.ts`'s login `authorize` had the identical exact-case lookup, meaning even a
   single account's login was needlessly case-sensitive (typing `Owner@...` at the login screen for an
   account stored as `owner@...` would fail). Confirmed live before the fix:
   `POST /api/settings/users` with `email: "Owner@KangnaBeauty.in"` returned `201`, not the expected
   `409`. **Fix (application-level, per this stage's own constraint to prefer that over a schema
   change):** added `.transform(v => v.toLowerCase())` to `createUserSchema`'s `email` field
   (`lib/validations/settings.ts`) and to `loginSchema`'s `email` field (`lib/validations/auth.ts`) —
   every email is now normalized to lowercase the moment it's parsed, on both the create-user and
   login paths, so the existing exact-case `findUnique` calls in both `app/api/settings/users/route.ts`
   and `lib/auth.ts` now correctly catch case-variant duplicates/logins without needing any change to
   those files themselves. No schema change; the single existing seeded user's email was already
   lowercase, so no data migration was needed. **Verified:** `POST /api/settings/users` with
   `email: "Owner@KangnaBeauty.in"` now correctly `409`s ("A user with this email already exists");
   created a fresh STAFF user with a mixed-case email (`QA.Staff.Test@Example.COM`), confirmed it was
   stored lowercase (`qa.staff.test@example.com`), then logged in with an all-lowercase variant of
   that same address and got a valid session — confirming both halves (creation-dedup and login) work
   end-to-end. Full STAFF role-based-access story exercised with that real STAFF session: `GET
   /api/customers` → `200`, `GET /api/export/customers` → `200`, `PATCH /api/settings/thresholds` and
   `GET /api/settings/users` → both `403` (OWNER-only). Test STAFF user deleted via the UI's own
   "Delete" button afterward (confirmed the `window.confirm` dialog and success toast), re-confirmed
   via `GET /api/settings/users` that only the original seeded OWNER remains.

4. **(Missing feature, not a regression — fixed since it was explicitly in this stage's test plan)**
   There was no UI entry point to create a new `MessageTemplate` at all. `POST /api/templates` and
   `lib/queries/message-templates.ts`'s `createTemplate` already existed and worked correctly
   (confirmed empty-body validation blocks with `400`, a valid `CUSTOM` template creates fine with
   `201`), but `TemplateEditor.tsx` only ever `PATCH`es an existing template — nothing in
   `components/messages/` or `app/(app)/messages/templates/page.tsx` ever called the create endpoint.
   **Fix:** added `components/messages/NewTemplateSheet.tsx` (same self-contained
   "owns its own open state" `AppleSheet` pattern as `QuickAddSheet`/`AddBillGlobalSheet` — type
   select, title, body, `react-hook-form` + a small local zod schema mirroring
   `createTemplateSchema`), wired into `app/(app)/messages/templates/page.tsx`'s header. New templates
   default to `isActive: true`, `type: "CUSTOM"` and can be retyped immediately after creation via
   `TemplateEditor` like any other template. **Verified:** in-browser — clicked "New Template",
   confirmed it renders alongside the 6 seeded ones (most-recently-updated-first ordering, matching
   `getAllTemplates`'s existing `orderBy`), and its live preview reacted correctly on every keystroke,
   same as the seeded templates'. Deleted the test template directly via Prisma afterward (no `DELETE
   /api/templates/[id]` route exists in this app — template deletion was never in scope for any prior
   stage, only create/edit/activate-toggle).

**WhatsApp Messaging — extensively verified beyond the bugs above, zero other bugs found:**
- `renderTemplate` (`lib/queries/message-templates.ts`) edge cases, checked via a throwaway script
  calling the real function directly (not a client-side mirror): `loyaltyPoints: 0` → renders `"0"`
  (not falsy-blank, confirming the `?? 0` + `String()` combo is correct, not a `|| 0` that would've
  been fine here anyway since 0 is falsy but the distinction matters conceptually);
  `lastVisitDate: null` → `"your last visit"` fallback, no "Invalid Date"; `favouriteCategory: null` →
  `"our collection"` fallback; an unrecognized `{{nonexistent}}` placeholder is left untouched as
  literal text, not stripped or crashed on.
- `buildWaMeLink` (`lib/whatsapp/link-mode.ts`): a body with emoji, a literal `&`, `#`, `%`-shaped
  text, and an embedded newline round-tripped exactly through `encodeURIComponent` →
  `new URL(link).searchParams.get("text")` → byte-identical to the original. Defensive/malformed input
  (empty string, non-numeric garbage, an already-`+91`-prefixed number, an 11-digit number) all
  degrade gracefully to a still-well-formed (if not necessarily meaningful) `wa.me` URL — confirmed no
  crash on any of them, consistent with the brief's note that this doesn't need a fix since customer
  data is validated upstream by `customerSchema`'s `^[6-9]\d{9}$` regex before ever reaching this
  function.
- `POST /api/messages/send` with a nonexistent `customerId` → clean `404 {"error":"Customer not
  found"}`, no crash. `POST /api/messages/bulk-send` with `customerIds: []` → `400` (zod's `.min(1)`
  blocks it before touching the DB). A mixed valid+invalid `customerIds` array → the valid recipient
  succeeds (`results`) and the invalid one is reported separately (`failures`), not aborting the whole
  batch — matches the design documented in Stage 6's own log.
- Single send (`SendMessageSheet`, in-browser): sent Priya Sharma an ANNIVERSARY message via the UI,
  confirmed the wa.me link opened correctly (`api.whatsapp.com/send/?phone=919800001234&text=...`,
  browser-native WhatsApp redirect), the success toast fired, and the "Messages Sent" tab correctly
  showed the new `SENT` log row with the exact rendered body (including the 💍 emoji, confirmed intact
  in the app's own stored `bodySent` and rendered UI — the WhatsApp redirect page's own display of the
  emoji appeared mangled in that external page, which is WhatsApp's own redirect service, not this
  app's encoding; the app's `MessageLog` row and `SendMessageSheet`'s preview both show it correctly).
- Bulk campaign builder (`CampaignBuilder`, in-browser): the "Inactive 30+" quick-pick audience
  correctly showed a **17-customer** live count (a genuinely large audience, exercising the
  brief's "15-20 customers" ask) with an accurate recipient count and a working "Start Send Queue";
  switching to "Manual Select" with nothing checked left "Start Send Queue" correctly `[disabled]` —
  zero-recipient campaigns are blocked in the UI (on top of the server's own `customerIds.min(1)`
  check).
- `WeMissYouPanel`: confirmed it's reading live `getInactiveCustomers(30)` data, not a cache — the
  campaigns page has `export const dynamic = "force-dynamic"` (documented in Stage 6's own log,
  re-confirmed here), and the panel's candidate count (17) exactly matched the "Inactive 30+" quick-pick
  audience computed from the same underlying call in the same request.
- Template CRUD: create (bug #4 above), edit-and-persist (`TemplateEditor`'s live preview reacts to
  every keystroke, confirmed in-browser), empty-body creation correctly blocked with `400` before any
  fix was needed (`createTemplateSchema`'s `body: z.string().min(1)` already worked).

**Settings — extensively verified, zero bugs found beyond bug #3 above:**
- `CategoryManager`: `PATCH /api/settings/categories` with `categories: []` → `400` ("At least one
  category is required"); `["Skincare","skincare","Makeup"]` (case-insensitive dupe) → `400`
  ("Category names must be unique") — both correctly surfaced by `categoriesSchema`'s existing
  `.refine()`, no fix needed. Confirmed the live category list (including the legitimate
  `"Bridal Package"` addition from Stage 9's own final integration pass, left in place per that
  stage's own log) is unchanged from this stage's pre-test baseline.
- `ThresholdsForm` / `thresholdsSchema`: direct API `PATCH` (bypassing the client form entirely, per
  the brief's own instruction) with a negative number, zero, and a non-integer (`30.5`) all correctly
  `400`'d server-side (`z.coerce.number().int().positive()` — "Too small: expected number to be >0"
  for the first two, "Invalid input: expected int, received number" for `30.5`) — confirms server-side
  validation isn't just a UI nicety. No fix needed.
- `StoreProfileForm` / `storeProfileSchema`: an accent color missing the `#` prefix and an
  entirely-invalid hex string both correctly `400`'d ("Enter a valid hex color, e.g. #0A84FF"). No fix
  needed.
- CSV export (`lib/csv.ts`): created a temporary customer with a name containing a double quote, a
  comma, **and** an embedded literal newline all at once (`QA "Test", Comma\nNewline`), exported via
  `GET /api/export/customers`, and parsed the raw CSV bytes with Python's `csv` module — the field
  round-tripped to the exact original string, the row wasn't corrupted/split, and the quote-doubling
  (`""Test""`) matched RFC 4180 exactly. Test customer deleted immediately after (no `DELETE
  /api/customers/[id]` route exists in this app, so cleanup was via a direct Prisma call, same as
  Stage 11's prior passes had to do for a couple of their own cleanup cases).
- `UserManagementTable` / user management, beyond bug #3: a password shorter than 6 characters
  correctly `400`'d ("Password must be at least 6 characters") both via the UI form and a direct API
  call. Delete-self and demote-self are both still correctly blocked (`400`, reconfirmed — this was
  already verified in Stage 9, not a regression).

**A note on the shared dev environment during this pass:** partway through this stage's testing, the
DB and working tree started showing changes this session didn't make — a new customer ("Yashika",
plus a bill and a `MessageLog` row) appeared, `lib/queries/bills.ts` and a brand-new (uncommitted,
still-`??`-status) `app/(app)/bills/page.tsx` showed live edits mid-session, and two new git commits
(`8c66d81`, `3abd5e5` — the latter titled "Filter inactive templates out of the campaign composer",
the same fix as bug #2 above) appeared in `git log` that this session never ran `git commit` for.
This confirms another agent/session was concurrently active on this exact shared repo and dev server
during this pass, same as Stage 9's documented parallel-agent situation. Consequently: the "Yashika"
customer/bill/message-log were **not** created by this stage's testing and were deliberately **not**
deleted (cleaning up a concurrent session's real data would be destructive, not helpful) — the DB's
final count therefore reads **28 customers / 116 bills / 5 `MessageLog` rows**, exactly one each above
this stage's own 27/115/4 starting baseline, entirely attributable to that other session, not to any
uncleaned test data from this pass (independently confirmed via a timestamp-filtered query showing
this stage's own two `MessageLog` test rows and one CSV-test customer were already deleted before that
other session's activity was even noticed). Similarly, `npm run build`'s final run hit a `tsc` error
in that same in-progress, not-yet-committed `app/(app)/bills/page.tsx` (a `StaggerList`/`StaggerItem`
`as` prop that component doesn't support) — confirmed **not** caused by this stage's changes by
temporarily relocating that untracked file and re-running `npx tsc --noEmit`, which came back
completely clean, then immediately restoring the file unchanged. The dev server was left running
(not `pkill`'d) given clear evidence of concurrent live use, matching Stage 9's own documented
precedent for a shared dev server.

**Cleanup:** The one throwaway CSV-escaping test customer, the two test `MessageLog` rows created by
this stage's own single-send and bulk-send verification calls, the temporary `QA Test Template`, and
the temporary STAFF user (`QA Staff Test`) were all deleted before finishing (confirmed via direct
Prisma counts immediately after each deletion). `AppSettings` (store profile, categories, thresholds)
were never modified by this stage's testing and remain exactly as they were at the start. All
throwaway verification scripts (`scripts-tmp-check-baseline.ts`, `scripts-tmp-verify-messaging.ts`,
`scripts-tmp-cleanup.ts`, `scripts-tmp-final-check.ts`, `scripts-tmp-diff-check.ts`) were deleted
before finishing. This stage's own contribution to the DB is verified back to exactly baseline; the
residual 28/116/5 counts are entirely the other concurrent session's, as detailed above.

**Verification:**
- `npx tsc --noEmit` — clean for every file this stage touched or could affect (confirmed both in the
  normal full-project run early in this pass, and again at the end with the unrelated concurrent
  in-progress file temporarily set aside, as detailed above).
- `npx eslint .` — clean throughout, same 2 pre-existing unrelated warnings as every prior stage's
  documented baseline, nothing new introduced by this stage's fixes.
- `npm run build` — succeeded early in this pass (before the concurrent session's uncommitted
  `app/(app)/bills/page.tsx` appeared); the final end-of-stage run hit that unrelated file's error, not
  anything from this stage — see the shared-dev-environment note above.
- Dev server left running (shared with a concurrently-active session — see above), not stopped.

**Files changed:** `app/api/messages/send/route.ts` + `app/api/messages/bulk-send/route.ts` (reject
sending with an inactive template, `400`); `app/(app)/messages/campaigns/page.tsx` (filter to active
templates before passing to `CampaignBuilder`/`WeMissYouPanel`); `lib/validations/auth.ts` +
`lib/validations/settings.ts` (lowercase-normalize email on login and user-creation, fixing
case-insensitive duplicate-email/login handling); `components/messages/NewTemplateSheet.tsx` (new —
the previously-missing template-creation UI) + `app/(app)/messages/templates/page.tsx` (wires it in).

---

**Full E2E QA sweep complete.** All three parallel passes — Auth/Customers/Billing,
Lists/Dashboard/Search & Notifications, and WhatsApp Messaging & Settings — are done. Running total
across all three: **9 bugs found and fixed** (3 in the first pass: unauthenticated API 401-vs-redirect,
`notFound()` returning `200` due to a shared `loading.tsx` Suspense boundary, plus the
`middleware.ts`→`proxy.ts` deprecation rename; 2 in the second pass: `%`/`_` LIKE-wildcard injection in
customer search, and a stale-response race condition in the command palette's debounced search; 4 in
this third pass: inactive templates sendable via direct API call, inactive templates still offered by
the campaign composer/We-Miss-You panel, case-insensitive duplicate email/login not caught, and a
missing template-creation UI), plus one legitimate missing-feature gap filled in this pass. Every area
of the application specified in the original build brief — auth, customers, billing/rollups,
automatic lists, the dashboard, global search, notifications/cron, WhatsApp messaging, and settings —
has now had an independent, adversarial end-to-end pass with full DB/API-layer verification, not just
UI click-throughs. The DB's structural baseline (27 customers / 115 bills / 1 user / 6 message
templates / default `AppSettings`) has been independently reconfirmed correct by all three passes;
any deviation from that exact count at any given moment during this final pass was due to concurrent
cross-session activity on the shared dev environment, not uncleaned test data, as documented above.

---

## Stage 12 — Deployment Gap Fixes: `/bills`, `/reports`, and a missing `postinstall`

**Prompt/request:** The user checked the live production deployment
(`kangana-crm.vercel.app`) directly and found `/reports` and `/bills` both 404ing on the
frontend, despite the Sidebar (built in Stage 1) linking to both. Also, one of the parallel
Stage-11 QA subagents (before hitting a mid-task session-limit interruption) discovered a real
production-deployment bug: `package.json` never had a `postinstall` script running
`prisma generate`, so a genuine git-triggered Vercel build (as opposed to a manual
`vercel --prod` upload of an already-`generate`d local `node_modules`) would fail outright —
Prisma 7's generated client (`lib/generated/prisma/`) is gitignored build output, not checked in,
so it must be regenerated on every fresh install.

**What was built:**
- **`postinstall` fix** — added `"postinstall": "prisma generate"` to `package.json`'s `scripts`
  block. This is the actual fix for why a from-scratch Vercel build (cloning the repo fresh, no
  local `node_modules`) would previously fail even though every local `npm run build` had always
  succeeded — `prisma generate` was only ever being run manually/incidentally during earlier
  stages' work, never as a declared part of the install lifecycle.
- **`/bills` page** (`app/(app)/bills/page.tsx`) — this was explicitly speced in the original
  Stage 4 brief ("List all bills at `/app/bills/page.tsx` with search/filter by date range,
  category, and amount range, and a CSV export button") but never actually built during Stage 4 —
  only the customer-scoped bill history (`BillHistoryTable`) was. Added:
  - `lib/queries/bills.ts`'s `getAllBills(params)` — a new export alongside the existing
    rollup-transaction functions, filtering by category/amount-range/date-range, joined with the
    owning customer's name/mobile, reverse-chronological.
  - `components/bills/BillFilterBar.tsx` — a direct structural mirror of Stage 8's
    `CustomerFilterBar.tsx` (URL-param-driven, `AppleSheet`-presented filter form), for
    consistency with the one other filterable list page in the app.
  - The page itself: a table (not cards, since tabular bill data reads better as a table),
    reusing `AddBillGlobalSheet` and linking to the already-built `/api/export/bills` CSV route.
- **`/reports` page** (`app/(app)/reports/page.tsx`) — **this one is a genuine spec gap, not a
  missed-implementation bug**: Stage 1's original design-system brief listed "Reports" as its own
  sidebar section, but none of the numbered build phases (2 through 10) ever defined what a
  Reports page should contain — Dashboard (Phase 7) ended up being the closest analog. Rather than
  silently redirect the dead link to `/` (which would've been the minimal-effort fix) or leave it
  404ing, built a small real page reusing Stage 7's existing `dashboard-stats.ts` query functions
  (`getDailySalesLast30Days`, `getSalesByCategory`, `getTotalSales`) and chart components
  (`RevenueChart`, `CategoryBreakdownChart`) as-is, plus Stage 5's `getTopSpenders` in a table, plus
  links to the two CSV exports already built in Stage 9. Deliberately minimal — no new query logic
  invented, no new chart types, just an honest assembly of what already existed under a page that
  the nav had been promising since Stage 1.

**Why:** The user found these as real, user-facing 404s on the actual deployed app — this wasn't
theoretical QA, it was a live bug report. `/bills` was a straightforward "finish what Stage 4 spec'd
but didn't build" fix. `/reports` required a judgment call between three options (redirect to
dashboard / leave it out / build something real); building something real using only
already-existing, already-tested query functions and chart components was chosen as the option that
neither invents unscoped new functionality nor leaves a nav promise broken.

**Verification:** `npx tsc --noEmit`, `npx eslint .` (same 2 pre-existing unrelated warnings, no new
ones), and `npm run build` all clean — the build output now lists `/bills` and `/reports` as real
routes (dynamic and static respectively) instead of missing pages. Logged in as
`owner@kangnabeauty.in` against a fresh `npm run dev`, confirmed via authenticated curl:
`/bills` → 200 with real "N bills matching" content and an "Export CSV" link;
`/reports` → 200 with "Top Spenders" table and "Total Sales This Month" stat both rendering real
data; `/bills?category=Skincare` → 200 (filter param round-trips); `/bills?minAmount=999999` →
correctly renders the "No bills yet" empty state rather than erroring. Dev server stopped after
verification.

**Note on DB state observed during this pass:** a real, non-test customer ("Yashika", created
2026-07-23, with a real bill and a real sent WhatsApp anniversary message) was found in the DB —
this is genuine data from the user actually using the live app, not QA test pollution, and was
deliberately left untouched rather than "cleaned up."

**Not yet done:** these fixes are committed to the local working tree but have **not been
redeployed to production** (`kangana-crm.vercel.app` still 404s on `/bills`/`/reports` until a
fresh deploy ships this code) — deploying to a live, shared production URL is a visible/hard-to-
silently-reverse action, so that step is intentionally left for explicit confirmation rather than
done automatically as part of this fix pass.

**Update:** the user confirmed via `AskUserQuestion`, and Stage 12's changes were pushed
(`git push origin main`) and deployed (`vercel --prod --yes`), then verified live at
`kangana-crm.vercel.app` — both `/bills` and `/reports` confirmed 200 with real content via an
authenticated curl session against the live URL.

---

## Stage 13 — Post-Launch Housekeeping

Several small follow-up requests after the initial launch, each confirmed with the user before any
destructive/visible action (deleting production data, pushing, deploying) per this project's
established pattern of asking before irreversible or shared-state changes.

**1. Removed seed/dummy data from the live database.** The user asked to remove seed/dummy data
but keep real usage. Since local dev and production point at the *exact same* Neon database (no
separate branch per environment), this was a live production data change. Identified the 25
original seed customers precisely by reproducing `prisma/seed.ts`'s deterministic mobile-number
generator (`9${800000000 + i*137 + 1234}`) rather than guessing by name — all 25 matched exactly.
Also found and included 2 more customers ("Test Duplicate", "Neelam Kapoor") that were leftover QA
artifacts from earlier E2E testing passes (zero bills, zero purchase, created seconds apart) — not
real data, confirmed via inspection before deleting. A third customer ("Yashika", real bill, real
sent WhatsApp message, realistic details) was correctly identified as genuine user activity and
left untouched. Deleted `MessageLog` and `Bill` rows for the 27 targeted customers first (FK
constraints are `ON DELETE RESTRICT`), then the `Customer` rows themselves, inside a transaction.
Kept the OWNER login and all 6 default templates per explicit user instruction. Final state: 1
customer (Yashika), 1 bill, 1 message log, 1 user, 6 templates. User confirmed via
`AskUserQuestion` before the delete ran (it was also blocked once by auto-mode's destructive-action
classifier, requiring the explicit confirmation).

**2. Public signup page — explicitly cancelled.** A signup-page build was started, then the user
killed the subagent mid-task and said they'd already told Claude not to build it. No files were
created before the kill (confirmed via `git status`), so nothing needed reverting. Not built —
noting this so a future session doesn't re-attempt it without re-confirming the user actually wants
it.

**3. Fixed a real navigation gap.** The user pointed out (with a screenshot) that `/messages/templates`
had no link anywhere in the UI — Campaigns existed in the Sidebar, but Templates was only reachable
by typing the URL directly. Added a "Manage Templates" button on the Campaigns page header and a
"Back to Campaigns" link on the Templates page. Also did a full three-way navigation audit at the
user's request afterward: every page has an inbound link, every `href`/`Link` target resolves to a
real route, and every client `fetch("/api/...")` call matches a real route handler — no other gaps
found.

**4. README overhaul with Mermaid architecture diagrams.** Replaced the untouched default
`create-next-app` README with real project docs: a system architecture flowchart (client → Vercel
proxy/cron → route handlers → domain query layer → Prisma → Neon), a sequence diagram tracing a
WhatsApp send end-to-end, and an ER diagram of the core data model — plus the real tech stack table
and setup/env-var instructions. **Verified the diagrams actually render**, not just that the syntax
looked plausible: installed `@mermaid-js/mermaid-cli` and rendered all three blocks to SVG/PNG
locally, confirming zero parse errors and visually sane layouts, before committing.

**5. Production domain change to `kangnafaizabad.vercel.app`.** The user renamed/aliased the Vercel
project's production URL from `kangana-crm.vercel.app` to `kangnafaizabad.vercel.app` (done via the
Vercel dashboard, observed already live when checked via `vercel project ls`). Since `NEXTAUTH_URL`
is a Vercel "Sensitive" env var (write-only — cannot be read back via `vercel env pull` or `ls`,
shows as `[SENSITIVE]`), it had to be blind-overwritten rather than diffed: removed and re-added
for the Production environment as `https://kangnafaizabad.vercel.app`, since NextAuth relies on
this value for correct callback URLs/cookie behavior. Also updated the README's "Live" link.
`kangana-crm.vercel.app` itself now 404s (the alias moved, not duplicated) — `kangnafaizabad.vercel.app`
is the one true production URL going forward.

**Why:** each of these was a direct, specific user request rather than proactive cleanup — this
project reached "done, live, and being used for real" status after Stage 12, so subsequent work is
in maintenance/iteration mode rather than the original 10-phase build sequence.

**Verification:** `npx tsc --noEmit`, `npx eslint .` clean throughout (checked after each change).
Data-cleanup dry-run reported exact match counts before the real delete ran. Nav-audit was a
grep-based systematic check of every `href`/`Link`/`fetch` call against real route files, not a
sampling. Mermaid diagrams rendered to actual image files and visually inspected. Domain change
confirmed via curl against the new URL (200 on `/login`) after the env var update and a fresh
`vercel --prod` deploy.

**6. Added the real store logo.** The user supplied `kangana_Store_logo.jpg` (a 413×413 pink/gold
"Kangna"/"कंगना" mark) and asked for it in the frontend and as the browser-tab favicon. Copied it
to `public/kangna-logo.jpg` (used as an `<Image>` in the Sidebar header, replacing the plain
"Kangna CRM" text-only header, and on the login page, replacing a generic Sparkles-icon
placeholder) and to `app/icon.jpg` (Next.js's file-convention favicon — auto-generates the
`<link rel="icon">` tags with no metadata code needed; deleted the old default `app/favicon.ico`
it supersedes).

**Real bug caught before shipping, not after:** `proxy.ts`'s middleware matcher only excluded the
old `favicon.ico` from the auth gate, not the new `icon.jpg` — so an unauthenticated request for
the favicon (e.g. the browser tab icon while sitting on `/login` itself, before any session cookie
exists) was getting 307-redirected to `/login` instead of returning the image, breaking the
favicon everywhere it's needed most. Caught by actually curling `/icon.jpg` and checking the
response was real JPEG bytes (not HTML) rather than trusting that "the file exists" meant "the
route works" — fixed by adding `icon.jpg`/`apple-icon.jpg` to the matcher's exclusion list.

**Why:** direct user request for branding; the favicon-matcher bug is exactly the kind of thing
that's invisible in a quick visual check (the tab icon just looks "missing/default" rather than
obviously broken) but shows up immediately under an actual HTTP status check.

**Verification:** `npx tsc --noEmit`, `npx eslint .` clean, `npm run build` succeeds with
`/icon.jpg` listed as a real static route. Curled `/icon.jpg` before the middleware fix (307,
broken) and after (200, real `image/jpeg` bytes). Curled both `/login` (logged out) and `/`
(logged in, via a real credentials-cookie session) and confirmed `kangna-logo.jpg` appears in the
rendered HTML both times. Sidebar's collapsed (72px icon-rail) state was deliberately left
showing no logo — a first attempt to fit a logo image alongside the existing search button in
that narrow width would have overflowed, so the collapsed state keeps its pre-existing
icon-only layout unchanged rather than risk a layout regression for a cosmetic addition.
