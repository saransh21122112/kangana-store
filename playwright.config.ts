import { defineConfig, devices } from "@playwright/test"
import path from "node:path"
import dotenv from "dotenv"

// Loaded explicitly (rather than relying on Next's own .env loading, which
// only applies inside `next dev`/`next build`) so credentials are available
// to the Playwright test process itself. `.env` first (real app secrets
// this project already has, e.g. CRON_SECRET — needed to call
// /api/cron/daily-check the same way Vercel Cron does), then
// `.env.test.local` layered on top for e2e-specific vars (E2E_OWNER_EMAIL
// etc.) — neither file is committed (see .gitignore's blanket `.env*` rule).
dotenv.config({ path: path.resolve(__dirname, ".env") })
dotenv.config({ path: path.resolve(__dirname, ".env.test.local") })

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"

/**
 * E2E regression suite for the live app — see testing/e2e/README.md for the
 * data-safety rules these tests must follow (this app has no separate test
 * database; local dev and production share the same Neon Postgres instance).
 */
export default defineConfig({
  testDir: "./testing/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Reuses an already-running `npm run dev` if one exists (the common case
  // during interactive development), otherwise starts one — either way the
  // suite always runs against a real dev server backed by the real DB.
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
