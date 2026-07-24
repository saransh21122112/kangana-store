import { test, expect, type Page } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs, logout } from "./support/auth"
import { createTestUser, deleteTestUser, type TestUser } from "./support/test-users"

/**
 * Fake, never-created IDs — safe to use against DELETE/PATCH endpoints
 * because `requireRole()` runs before any DB lookup in every route handler
 * (confirmed by reading each route), so a 403 is returned without the
 * target row needing to exist. These calls never touch real data.
 */
const FAKE_BILL_ID = "e2e-nonexistent-bill-id"
const FAKE_CUSTOMER_ID = "e2e-nonexistent-customer-id"

test.describe("Role-based access control", () => {
  let staffUser: TestUser
  let viewerUser: TestUser

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    staffUser = await createTestUser(page, "STAFF")
    viewerUser = await createTestUser(page, "VIEWER")
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await deleteTestUser(page, staffUser.id)
    await deleteTestUser(page, viewerUser.id)
    await page.close()
  })

  test("STAFF: nav hides Dashboard/Reports/Campaigns/Settings-users, direct URLs redirect", async ({
    page,
  }) => {
    await loginAs(page, staffUser.email, staffUser.password)

    const navLinks = page.locator("aside nav a")
    await expect(navLinks).toHaveText(["Customers", "Visits/Bills", "Lists", "Inventory", "Settings"])

    for (const path of ["/", "/reports", "/messages/campaigns", "/messages/templates"]) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/customers$/)
    }

    await logout(page)
  })

  test("STAFF: create/read still work, delete/send are blocked at the API", async ({ page }) => {
    await loginAs(page, staffUser.email, staffUser.password)

    await expectStatus(page, "DELETE", `/api/bills/${FAKE_BILL_ID}`, 403)
    await expectStatus(page, "DELETE", `/api/customers/${FAKE_CUSTOMER_ID}`, 403)
    await expectStatus(page, "POST", "/api/messages/send", 403)
    await expectStatus(page, "POST", "/api/messages/bulk-send", 403)
    await expectStatus(page, "GET", "/api/settings/users", 403)
    await expectStatus(page, "GET", "/api/customers", 200)

    await logout(page)
  })

  test("VIEWER: nav shows only Dashboard/Customers/Bills/Lists/Inventory/Reports", async ({ page }) => {
    await loginAs(page, viewerUser.email, viewerUser.password)

    const navLinks = page.locator("aside nav a")
    await expect(navLinks).toHaveText([
      "Dashboard",
      "Customers",
      "Visits/Bills",
      "Lists",
      "Inventory",
      "Reports",
    ])

    for (const path of ["/settings", "/messages/campaigns", "/messages/templates"]) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/customers$/)
    }

    await logout(page)
  })

  test("VIEWER: no mutation/export UI renders, and every mutation/export API 403s", async ({
    page,
  }) => {
    await loginAs(page, viewerUser.email, viewerUser.password)
    await page.goto("/customers")

    for (const label of ["New Customer", "Quick Add", "Add Bill", "Export CSV"]) {
      await expect(page.getByRole("button", { name: label })).toHaveCount(0)
    }

    await expectStatus(page, "POST", "/api/customers", 403)
    await expectStatus(page, "POST", "/api/bills", 403)
    await expectStatus(page, "DELETE", `/api/bills/${FAKE_BILL_ID}`, 403)
    await expectStatus(page, "DELETE", `/api/customers/${FAKE_CUSTOMER_ID}`, 403)
    await expectStatus(page, "GET", "/api/export/customers", 403)
    await expectStatus(page, "GET", "/api/export/bills", 403)
    await expectStatus(page, "PATCH", "/api/settings/store", 403)
    await expectStatus(page, "POST", "/api/messages/send", 403)
    // VIEWER can still read — reads are the whole point of the role.
    await expectStatus(page, "GET", "/api/customers", 200)

    await logout(page)
  })

  test("OWNER's own row can't self-demote or self-delete", async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.goto("/settings")
    await page.getByRole("tab", { name: "Users" }).click()

    const ownerRow = page.locator("tr", { hasText: OWNER_EMAIL })
    await expect(ownerRow.locator("[role='combobox']")).toBeDisabled()
    await expect(ownerRow.getByRole("button", { name: "Delete" })).toBeDisabled()

    await logout(page)
  })
})

async function expectStatus(
  page: Page,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  status: number
): Promise<void> {
  const res = await page.request.fetch(url, {
    method,
    data: method === "POST" || method === "PATCH" ? {} : undefined,
  })
  expect(res.status(), `${method} ${url}`).toBe(status)
}
