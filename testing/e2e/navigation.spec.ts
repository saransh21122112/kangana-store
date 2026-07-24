import { test, expect } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs } from "./support/auth"

const ROUTES: Array<{ href: string; heading: string | RegExp }> = [
  { href: "/", heading: "Dashboard" },
  { href: "/customers", heading: "Customers" },
  { href: "/bills", heading: "Visits & Bills" },
  { href: "/lists", heading: "Lists" },
  { href: "/reports", heading: "Reports" },
  { href: "/settings", heading: "Settings" },
  { href: "/messages/campaigns", heading: "Campaigns" },
  { href: "/messages/templates", heading: "Message Templates" },
]

test.describe("Navigation and route transitions", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
  })

  for (const route of ROUTES) {
    test(`${route.href} renders with no console errors`, async ({ page }) => {
      const errors: string[] = []
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text())
      })
      page.on("pageerror", (err) => errors.push(err.message))

      await page.goto(route.href)
      await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible()

      expect(errors, `console errors on ${route.href}:\n${errors.join("\n")}`).toEqual([])
    })
  }

  test("clicking through several routes in sequence never leaves stale/duplicate content", async ({
    page,
  }) => {
    await page.goto("/")
    await page.locator("aside").getByRole("link", { name: "Customers" }).click()
    await expect(page).toHaveURL(/\/customers$/)
    await page.locator("aside").getByRole("link", { name: "Visits/Bills" }).click()
    await expect(page).toHaveURL(/\/bills$/)
    await page.locator("aside").getByRole("link", { name: "Reports" }).click()
    await expect(page).toHaveURL(/\/reports$/)
    // Only one <h1> should ever be present — a leftover/duplicated
    // AnimatePresence-exiting page would show two.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
  })
})
