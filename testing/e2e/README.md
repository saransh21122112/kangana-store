# E2E regression suite

Runs with [Playwright Test](https://playwright.dev/) against a real running
`npm run dev` instance. Run with:

```
npm run test:e2e
```

## CI

`.github/workflows/ci.yml` runs `tsc`/`eslint`/`next build` automatically on
every push and PR — no secrets needed, no DB access.

This suite does **not** run automatically anywhere. `.github/workflows/e2e.yml`
is `workflow_dispatch`-only (triggered manually from the GitHub Actions tab),
by design — it touches the real, shared production database (see the rules
below), so it never runs unattended on a push or PR. Running it in GitHub
Actions requires these repo secrets set first: `DATABASE_URL`,
`DATABASE_URL_UNPOOLED`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `E2E_OWNER_EMAIL`,
`E2E_OWNER_PASSWORD`.

## Data-safety rules (read before adding a test)

This app has **no separate test database** — local dev and production share
the same Neon Postgres instance (see `MEMORY.md`). Every test in this suite
must follow these rules:

1. **Never delete, edit, or overwrite real data.** Tests that exercise
   delete/edit UI (bill delete, customer delete, edit-details) must stop
   short of actually submitting — dismiss confirm dialogs, verify
   disabled/enabled gating, but never complete the mutation against a real
   `Customer`/`Bill` row. See `delete-flows.spec.ts` for the pattern.
   **Exception:** rows a test creates itself (e.g. `inventory.spec.ts`'s
   throwaway `InventoryItem`s, named with a `E2E ... <timestamp>` prefix) are
   not real data — creating, mutating, and actually deleting them in the
   same test is fine and expected, same reasoning as throwaway test users.
   The rule is about never touching data the test didn't create.
2. **Role tests create their own throwaway users, and always clean up.**
   Tests that need a STAFF or VIEWER session create a dedicated account
   through the real `Settings → Users` API (`support/test-users.ts`), scoped
   to that test file, and delete it in an `afterAll` — which Playwright runs
   even if a test in the file failed. Test user emails are prefixed
   `e2e-<role>-` so a crashed run's leftovers are easy to spot and manually
   remove from Settings → Users if cleanup itself failed.
3. **Read-only tests need no cleanup** — navigation, nav-filtering, PDF
   download, login-page rendering, and console-error checks only ever read
   data, never write it.
4. **Credentials come from `.env.test.local`** (gitignored, not committed) —
   `E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD`, an existing real OWNER account.
   Never hardcode credentials in a spec file. `low-stock-notifications.spec.ts`
   also needs `CRON_SECRET` — read from this project's real `.env` (not
   `.env.test.local`), since `playwright.config.ts` loads both; it `test.skip`s
   itself if that var isn't set rather than failing.

## Files

- `support/env.ts` — reads/validates the required env vars.
- `support/auth.ts` — `loginAs(page, email, password)` / `logout(page)`.
- `support/test-users.ts` — `createTestUser(request, role)` /
  `deleteTestUser(request, id)`, used by role-gating tests.
- `login.spec.ts` — login page rendering (logo, transition), auth flow.
- `navigation.spec.ts` — every main route reachable as OWNER, no console
  errors, route-transition smoke test.
- `roles.spec.ts` — STAFF/VIEWER nav filtering, redirects, and the full API
  403 matrix, against throwaway accounts.
- `pdf-download.spec.ts` — bill PDF download returns real PDF bytes with
  correct headers.
- `delete-flows.spec.ts` — delete-bill confirm dialog and delete-customer
  type-to-confirm gating, both non-destructive.
- `windows-friendly.spec.ts` — the search-shortcut tooltip shows "Ctrl+K" on
  a spoofed non-Mac platform and "⌘K" on a spoofed Mac platform.
- `inventory.spec.ts` — full CRUD lifecycle, stock-quantity clamping, filters,
  and role gating for the inventory tracker, against throwaway self-created
  items (see the delete-flows exception above).
- `low-stock-notifications.spec.ts` — calls the real `/api/cron/daily-check`
  route (same auth header Vercel Cron uses) against a throwaway low-stock
  item, asserting exactly one notification is created and a second run
  within the 24h window doesn't duplicate it.
- `bill-inventory-linking.spec.ts` — optionally linking a bill to a stocked
  item: stock decrements atomically on sale, overselling is rejected with
  the bill never created and stock left untouched, and deleting a linked
  bill restores the stock. Uses throwaway self-created customers/items/bills
  throughout (see the delete-flows exception above).
