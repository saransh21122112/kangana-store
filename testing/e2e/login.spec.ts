import { test, expect } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { logout } from "./support/auth"

test.describe("Login page", () => {
  test("logo image actually loads (regression: was rendering blank due to untrimmed source asset)", async ({
    page,
  }) => {
    await page.goto("/login")
    const logo = page.getByAltText("Kangna")
    await expect(logo).toBeVisible()
    const naturalWidth = await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)
    expect(naturalWidth).toBeGreaterThan(0)
  })

  test("heading, subtitle, and gradient-hairline signature element render", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: "Kangna CRM" })).toBeVisible()
    await expect(page.getByText("Sign in to continue")).toBeVisible()
    await expect(page.locator(".gradient-hairline")).toBeVisible()
  })

  test("card entrance animation settles to full opacity", async ({ page }) => {
    await page.goto("/login")
    const card = page.locator("form").locator("..")
    await expect(card).toHaveCSS("opacity", "1", { timeout: 2000 })
  })

  test("invalid credentials show an inline error, not a crash", async ({ page }) => {
    await page.goto("/login")
    await page.locator("#email").fill("nobody@kangnabeauty.in")
    await page.locator("#password").fill("wrong-password")
    await page.getByRole("button", { name: "Sign in" }).click()
    // Scoped to the form's own error text — the page also has a Next.js
    // route-announcer `[role="alert"]` that `getByRole("alert")` alone
    // would also match (and it's empty, so a bare role query is ambiguous).
    await expect(page.getByText(/invalid email or password/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test("valid OWNER credentials log in and redirect away from /login", async ({ page }) => {
    await page.goto("/login")
    await page.locator("#email").fill(OWNER_EMAIL)
    await page.locator("#password").fill(OWNER_PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10_000 })
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()
    await logout(page)
  })
})
