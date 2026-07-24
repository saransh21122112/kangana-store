import { test, expect } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs } from "./support/auth"

/**
 * These tests verify the delete-confirmation UI (dialog text, disabled/
 * enabled gating) without ever completing a real deletion — see
 * testing/e2e/README.md rule #1. The bill/customer confirm dialogs are
 * always dismissed, never accepted; the customer delete sheet is opened,
 * probed, and closed by navigating away instead of submitting.
 */
test.describe("Delete flows (non-destructive)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
  })

  test("delete-bill confirm dialog shows the expected text and cancelling deletes nothing", async ({
    page,
  }) => {
    await page.goto("/bills")
    const rowCountBefore = await page.locator('button[aria-label="Delete bill"]').count()
    expect(rowCountBefore).toBeGreaterThan(0)

    let dialogMessage = ""
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message()
      await dialog.dismiss()
    })
    await page.locator('button[aria-label="Delete bill"]').first().click()

    expect(dialogMessage).toBe("Delete this bill? This can't be undone.")
    const rowCountAfter = await page.locator('button[aria-label="Delete bill"]').count()
    expect(rowCountAfter).toBe(rowCountBefore)
  })

  test("delete-customer sheet requires typing the exact name before enabling, and closing submits nothing", async ({
    page,
  }) => {
    await page.goto("/customers")
    // Excludes the page's own "New Customer" link (href="/customers/new"),
    // which also matches a naive `^="/customers/"` prefix and sits earlier
    // in the DOM than any actual customer card.
    await page.locator('a[href^="/customers/"]:not([href="/customers/new"])').first().click()
    await page.waitForURL(/\/customers\/[^/]+$/)

    const customerName = await page.getByRole("heading", { level: 1 }).textContent()
    expect(customerName).toBeTruthy()

    await page.getByRole("button", { name: "Delete Customer" }).click()
    const dialog = page.getByRole("dialog", { name: "Delete Customer" })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText("permanently deletes this customer");

    const confirmInput = dialog.locator("#delete-confirm-name")
    const confirmButton = dialog.getByRole("button", { name: "Delete Customer" })

    await confirmInput.fill("definitely the wrong name")
    await expect(confirmButton).toBeDisabled()

    await confirmInput.fill(customerName!.trim())
    await expect(confirmButton).toBeEnabled()

    // Never click confirmButton — close the sheet instead, proving the
    // customer still exists via a fresh GET.
    await dialog.getByRole("button", { name: "Close" }).click()
    await expect(dialog).toBeHidden()

    const url = page.url()
    const id = url.split("/customers/")[1]
    const res = await page.request.get(`/api/customers/${id}`)
    expect(res.status()).toBe(200)
  })
})
