import type { Page } from "@playwright/test"

/** Logs in via the real login form and waits for the post-login redirect. */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  // Every role lands somewhere other than /login on success (OWNER/STAFF at
  // a role-appropriate route, VIEWER at "/") — waiting for the URL to
  // change away from /login is the one thing all three have in common.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10_000 })
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click()
  await page.waitForURL(/\/login/, { timeout: 10_000 })
}
