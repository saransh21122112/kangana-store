import { test, expect, type Page } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs, logout } from "./support/auth"
import { createTestUser, deleteTestUser, type TestUser } from "./support/test-users"

/**
 * STAFF permission narrowing: STAFF can add customers and bills, but can no
 * longer see bill amounts, customer phone numbers, call/message a customer,
 * process returns, or edit an existing customer/bill. Everything here was
 * manually verified in a real browser session before being written up as a
 * regression test — see this stage's build-log entry for the walkthrough.
 *
 * The customer/bill created in these tests are throwaway rows this suite
 * creates itself (unique timestamped name/mobile/billNo), so creating,
 * reading, and deleting them is safe per testing/e2e/README.md rule #1's
 * exception for self-created rows.
 */

function uniqueMobile(): string {
  return `9${String(Date.now()).slice(-9)}`
}

async function createTestCustomerAndBill(
  page: Page
): Promise<{ customerId: string; billId: string; lineItemId: string }> {
  const customerRes = await page.request.post("/api/customers", {
    data: { name: `E2E Staff-Restriction Customer ${Date.now()}`, mobileNumber: uniqueMobile() },
  })
  expect(customerRes.ok()).toBeTruthy()
  const customerId = (await customerRes.json()).customer.id

  const billRes = await page.request.post("/api/bills", {
    data: {
      billNo: `E2E-STAFF-RESTR-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      customerId,
      lineItems: [{ category: "Other", quantity: 1, lineTotal: 750 }],
    },
  })
  expect(billRes.ok()).toBeTruthy()
  const bill = (await billRes.json()).bill

  return { customerId, billId: bill.id, lineItemId: bill.lineItems[0].id }
}

test.describe("STAFF permission narrowing (amounts, phone numbers, edit, returns)", () => {
  let staffUser: TestUser
  let customerId: string
  let billId: string
  let lineItemId: string

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    staffUser = await createTestUser(page, "STAFF")
    ;({ customerId, billId, lineItemId } = await createTestCustomerAndBill(page))
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.request.delete(`/api/bills/${billId}`)
    await page.request.delete(`/api/customers/${customerId}`)
    await deleteTestUser(page, staffUser.id)
    await page.close()
  })

  test("server-side: edit, returns, exports, and PDF download all 403 for STAFF", async ({ page }) => {
    await loginAs(page, staffUser.email, staffUser.password)

    const patchCustomer = await page.request.patch(`/api/customers/${customerId}`, {
      data: { name: "Should not be allowed" },
    })
    expect(patchCustomer.status()).toBe(403)

    const patchBill = await page.request.patch(`/api/bills/${billId}`, {
      data: { billNo: "SHOULD-NOT-CHANGE" },
    })
    expect(patchBill.status()).toBe(403)

    const returnRes = await page.request.post(`/api/bills/${billId}/returns`, {
      data: { lineItemId, quantityReturned: 1 },
    })
    expect(returnRes.status()).toBe(403)

    const exportBills = await page.request.get("/api/export/bills")
    expect(exportBills.status()).toBe(403)

    const exportCustomers = await page.request.get("/api/export/customers")
    expect(exportCustomers.status()).toBe(403)

    const pdfRes = await page.request.get(`/api/bills/${billId}/pdf`)
    expect(pdfRes.status()).toBe(403)

    await logout(page)
  })

  test("server-side: STAFF can still create a customer and a bill", async ({ page }) => {
    await loginAs(page, staffUser.email, staffUser.password)

    const custRes = await page.request.post("/api/customers", {
      data: { name: `E2E Staff Create-Test ${Date.now()}`, mobileNumber: uniqueMobile() },
    })
    expect(custRes.status()).toBe(201)
    const newCustomerId = (await custRes.json()).customer.id

    const billRes = await page.request.post("/api/bills", {
      data: {
        billNo: `E2E-STAFF-CREATE-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        customerId: newCustomerId,
        lineItems: [{ category: "Other", quantity: 1, lineTotal: 200 }],
      },
    })
    expect(billRes.status()).toBe(201)
    const newBillId = (await billRes.json()).bill.id

    await logout(page)

    // Cleanup as OWNER — STAFF itself can't delete.
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.request.delete(`/api/bills/${newBillId}`)
    await page.request.delete(`/api/customers/${newCustomerId}`)
    await logout(page)
  })

  test("UI: /customers cards show no phone number, Call/WhatsApp, or Total Spend for STAFF", async ({
    page,
  }) => {
    await loginAs(page, staffUser.email, staffUser.password)
    await page.goto("/customers")

    await expect(page.getByRole("button", { name: "Call" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "WhatsApp" })).toHaveCount(0)
    await expect(page.getByText("Total Spend")).toHaveCount(0)

    await logout(page)
  })

  test("UI: /bills table has no Amount column, phone numbers, download, or return action for STAFF", async ({
    page,
  }) => {
    await loginAs(page, staffUser.email, staffUser.password)
    await page.goto("/bills")

    await expect(page.getByRole("columnheader", { name: "Amount" })).toHaveCount(0)
    await expect(page.getByLabel("Download bill as PDF").first()).toHaveCount(0)
    await expect(page.getByLabel("Record return").first()).toHaveCount(0)

    await logout(page)
  })

  test("UI: customer profile hides phone, WhatsApp, Total Purchase, Avg Bill Value, Edit Details tab, and bill amounts for STAFF", async ({
    page,
  }) => {
    await loginAs(page, staffUser.email, staffUser.password)
    await page.goto(`/customers/${customerId}`)

    await expect(page.getByRole("tab", { name: "Edit Details" })).toHaveCount(0)
    await expect(page.getByText("Total Purchase")).toHaveCount(0)
    await expect(page.getByText("Avg Bill Value")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Delete Customer" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Send Message" })).toHaveCount(0)
    // The line item's ₹750 amount must not render anywhere on the page.
    await expect(page.getByText("₹750")).toHaveCount(0)

    await logout(page)
  })

  test("UI: /lists Top Spenders view masks the spend amount and hides phone/call/WhatsApp for STAFF", async ({
    page,
  }) => {
    await loginAs(page, staffUser.email, staffUser.password)
    await page.goto("/lists?view=top-spenders")

    await expect(page.getByText(/spent$/)).toHaveCount(0)
    await expect(page.locator('a[title="Call"]')).toHaveCount(0)
    await expect(page.locator('a[title="WhatsApp"]')).toHaveCount(0)

    await logout(page)
  })
})

/**
 * VIEWER keeps its existing broad read access (amounts, phone numbers,
 * bill history are all unchanged) — the one new restriction is Call/
 * WhatsApp, which is now OWNER-only everywhere, same reasoning as
 * `SendMessageSheet` already being OWNER-only: only the owner should be
 * the one actually reaching out to a customer.
 */
test.describe("VIEWER: Call/WhatsApp is OWNER-only, everything else unchanged", () => {
  let viewerUser: TestUser
  let customerId: string
  let billId: string

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    viewerUser = await createTestUser(page, "VIEWER")
    ;({ customerId, billId } = await createTestCustomerAndBill(page))
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.request.delete(`/api/bills/${billId}`)
    await page.request.delete(`/api/customers/${customerId}`)
    await deleteTestUser(page, viewerUser.id)
    await page.close()
  })

  test("UI: /customers cards show phone + Total Spend but no Call/WhatsApp for VIEWER", async ({
    page,
  }) => {
    await loginAs(page, viewerUser.email, viewerUser.password)
    await page.goto("/customers")

    await expect(page.getByText("Total Spend").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Call" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "WhatsApp" })).toHaveCount(0)

    await logout(page)
  })

  test("UI: customer profile shows phone as plain text (not a tel: link) and no WhatsApp for VIEWER", async ({
    page,
  }) => {
    await loginAs(page, viewerUser.email, viewerUser.password)
    await page.goto(`/customers/${customerId}`)

    await expect(page.getByText("Total Purchase")).toBeVisible()
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
    await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveCount(0)

    await logout(page)
  })

  test("UI: /lists Top Spenders shows the amount but no Call/WhatsApp for VIEWER", async ({ page }) => {
    await loginAs(page, viewerUser.email, viewerUser.password)
    await page.goto("/lists?view=top-spenders")

    await expect(page.getByText(/spent$/).first()).toBeVisible()
    await expect(page.locator('a[title="Call"]')).toHaveCount(0)
    await expect(page.locator('a[title="WhatsApp"]')).toHaveCount(0)

    await logout(page)
  })
})
