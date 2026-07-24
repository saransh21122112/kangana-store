import type { Page } from "@playwright/test"

export type TestRole = "STAFF" | "VIEWER"

export interface TestUser {
  id: string
  name: string
  email: string
  password: string
  role: TestRole
}

/**
 * Creates a throwaway STAFF/VIEWER account through the real
 * `POST /api/settings/users` route (not raw SQL) using `page.request`, which
 * shares the browsing context's session cookie — so `page` must already be
 * logged in as OWNER before calling this. Email is prefixed `e2e-<role>-`
 * plus a timestamp so parallel/repeated runs never collide, and so a failed
 * cleanup is trivially recognizable in Settings → Users.
 */
export async function createTestUser(page: Page, role: TestRole): Promise<TestUser> {
  const stamp = Date.now()
  const email = `e2e-${role.toLowerCase()}-${stamp}@kangnabeauty.in`
  const password = `E2eTest${stamp}!`
  const name = `E2E ${role} Test`

  const res = await page.request.post("/api/settings/users", {
    data: { name, email, password, role },
  })
  if (!res.ok()) {
    throw new Error(`Failed to create ${role} test user: ${res.status()} ${await res.text()}`)
  }
  const body = await res.json()
  return { id: body.user.id, name, email, password, role }
}

/** Deletes a test user created by `createTestUser`. Safe to call with an
 * already-deleted id — a 404 here is not a test failure, it just means
 * cleanup already happened (e.g. a prior run's partial failure). */
export async function deleteTestUser(page: Page, id: string): Promise<void> {
  const res = await page.request.delete(`/api/settings/users?id=${encodeURIComponent(id)}`)
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`Failed to delete test user ${id}: ${res.status()} ${await res.text()}`)
  }
}
