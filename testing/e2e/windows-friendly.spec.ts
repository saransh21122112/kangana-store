import { test, expect } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs } from "./support/auth"

test.describe("Windows-friendly UI", () => {
  test("search shortcut tooltip shows 'Ctrl+K' on a non-Mac platform", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "platform", { value: "Win32", configurable: true })
    })
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await expect(page.getByRole("button", { name: "Search customers" })).toHaveAttribute(
      "title",
      "Search (Ctrl+K)"
    )
  })

  test("search shortcut tooltip shows '⌘K' on a spoofed Mac platform", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "platform", { value: "MacIntel", configurable: true })
    })
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await expect(page.getByRole("button", { name: "Search customers" })).toHaveAttribute(
      "title",
      "Search (⌘K)"
    )
  })

  test("Ctrl+K opens the command palette (not just Cmd+K)", async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    // Ensure the dashboard has actually finished mounting its keydown
    // listener before sending the shortcut — waiting on a stable, always-
    // present element is more reliable than a fixed timeout.
    await expect(page.getByRole("button", { name: "Search customers" })).toBeVisible()
    await page.keyboard.press("Control+k")
    await expect(page.getByRole("dialog")).toBeVisible()
  })
})
