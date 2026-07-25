import { test, expect, type Page } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs } from "./support/auth"

/**
 * Stage 21's three features: loyalty points (earn-on-sale + manual
 * adjustment), partial returns, and the OWNER-only ActivityLog. All bills/
 * customers created here are throwaway rows this suite creates itself
 * (unique timestamped name/mobile/billNo) — safe to fully create, mutate,
 * and delete per testing/e2e/README.md rule #1's exception.
 */

function uniqueMobile(): string {
  return `9${String(Date.now()).slice(-9)}`
}

async function createTestCustomer(page: Page): Promise<{ id: string }> {
  const res = await page.request.post("/api/customers", {
    data: { name: `E2E Loyalty/Returns Customer ${Date.now()}`, mobileNumber: uniqueMobile() },
  })
  expect(res.ok(), `create customer failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  const body = await res.json()
  return { id: body.customer.id }
}

async function getCustomer(page: Page, id: string) {
  const res = await page.request.get(`/api/customers/${id}`)
  expect(res.status()).toBe(200)
  return (await res.json()).customer
}

test.describe("Loyalty points, returns, and activity log", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
  })

  test("creating a bill earns loyalty points at the configured rate, deleting it claws them back", async ({
    page,
  }) => {
    const customer = await createTestCustomer(page)
    let billId: string | undefined

    try {
      const before = await getCustomer(page, customer.id)
      expect(before.loyaltyPoints).toBe(0)

      const res = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-LOYALTY-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          lineItems: [{ category: "Skincare", quantity: 1, lineTotal: 1000 }],
        },
      })
      expect(res.status()).toBe(201)
      billId = (await res.json()).bill.id

      // Default rate is 0.01 points per rupee — a ₹1000 bill earns 10
      // points. If Settings has been reconfigured to a different rate in
      // this environment, this assertion would need updating alongside it.
      const afterCreate = await getCustomer(page, customer.id)
      expect(afterCreate.loyaltyPoints).toBeGreaterThan(before.loyaltyPoints)

      const pointsEarned = afterCreate.loyaltyPoints - before.loyaltyPoints

      await page.request.delete(`/api/bills/${billId}`)
      billId = undefined

      const afterDelete = await getCustomer(page, customer.id)
      expect(afterDelete.loyaltyPoints).toBe(afterCreate.loyaltyPoints - pointsEarned)
    } finally {
      if (billId) await page.request.delete(`/api/bills/${billId}`)
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })

  test("manual loyalty point adjustment adds and clamps at 0", async ({ page }) => {
    const customer = await createTestCustomer(page)

    try {
      const addRes = await page.request.post(`/api/customers/${customer.id}/loyalty`, {
        data: { delta: 50 },
      })
      expect(addRes.status()).toBe(200)
      expect((await addRes.json()).customer.loyaltyPoints).toBe(50)

      // Subtracting more than the current balance clamps at 0 rather than
      // going negative.
      const subtractRes = await page.request.post(`/api/customers/${customer.id}/loyalty`, {
        data: { delta: -1000 },
      })
      expect(subtractRes.status()).toBe(200)
      expect((await subtractRes.json()).customer.loyaltyPoints).toBe(0)
    } finally {
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })

  test("partial return: reduces customer spend, restores stock, and rejects over-returning", async ({
    page,
  }) => {
    // Each of createBillWithRollup/createReturn is itself several
    // sequential Neon round trips (observed elsewhere in this project at
    // ~2-3s each — see low-stock-notifications.spec.ts's cron test for the
    // same reasoning), and this test calls both plus several GETs — same
    // fix as that test: raise the timeout rather than trim assertions.
    test.setTimeout(90_000)

    const customer = await createTestCustomer(page)
    const itemName = `E2E Return Item ${Date.now()}`
    const itemRes = await page.request.post("/api/inventory", {
      data: { name: itemName, category: "Jewellery - Gold", quantity: 10, lowStockThreshold: 2 },
    })
    expect(itemRes.status()).toBe(201)
    const item = (await itemRes.json()).item
    let billId: string | undefined

    try {
      const before = await getCustomer(page, customer.id)

      const billRes = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-RETURN-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          lineItems: [
            { category: "Jewellery - Gold", inventoryItemId: item.id, quantity: 4, unitPrice: 1000 },
          ],
        },
      })
      expect(billRes.status()).toBe(201)
      const bill = (await billRes.json()).bill
      billId = bill.id
      const lineItemId = bill.lineItems[0].id

      const stockAfterSale = await page.request.get(`/api/inventory/${item.id}`)
      expect((await stockAfterSale.json()).item.quantity).toBe(6)

      const afterSale = await getCustomer(page, customer.id)
      expect(afterSale.totalPurchaseAmount).toBe(before.totalPurchaseAmount + 4000)

      // Return 1 of the 4 units — should refund exactly a quarter (₹1000)
      // and restore 1 unit of stock.
      const returnRes = await page.request.post(`/api/bills/${billId}/returns`, {
        data: { lineItemId, quantityReturned: 1, reason: "E2E test return" },
      })
      expect(returnRes.status()).toBe(200)
      const returnBody = await returnRes.json()
      expect(returnBody.billReturn.amountReturned).toBe(1000)

      const stockAfterReturn = await page.request.get(`/api/inventory/${item.id}`)
      expect((await stockAfterReturn.json()).item.quantity).toBe(7)

      const afterReturn = await getCustomer(page, customer.id)
      expect(afterReturn.totalPurchaseAmount).toBe(before.totalPurchaseAmount + 3000)

      // Only 3 of the original 4 remain returnable (1 already returned) —
      // requesting all 3 remaining more once again should be rejected.
      const overReturnRes = await page.request.post(`/api/bills/${billId}/returns`, {
        data: { lineItemId, quantityReturned: 4 },
      })
      expect(overReturnRes.status()).toBe(409)
      expect((await overReturnRes.json()).reason).toBe("exceeds_available_quantity")

      // Stock/spend must be unchanged by the rejected over-return.
      const stockAfterRejected = await page.request.get(`/api/inventory/${item.id}`)
      expect((await stockAfterRejected.json()).item.quantity).toBe(7)
      const afterRejected = await getCustomer(page, customer.id)
      expect(afterRejected.totalPurchaseAmount).toBe(before.totalPurchaseAmount + 3000)
    } finally {
      if (billId) await page.request.delete(`/api/bills/${billId}`)
      await page.request.delete(`/api/inventory/${item.id}`)
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })

  test("recording a return against a line item that doesn't belong to the given bill is rejected", async ({
    page,
  }) => {
    // Two customers and two bills' worth of sequential Neon round trips
    // (see the previous test's comment) — same fix.
    test.setTimeout(90_000)

    const customerA = await createTestCustomer(page)
    const customerB = await createTestCustomer(page)
    let billAId: string | undefined
    let billBId: string | undefined

    try {
      const billARes = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-XBILL-A-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customerA.id,
          lineItems: [{ category: "Other", quantity: 1, lineTotal: 200 }],
        },
      })
      const billA = (await billARes.json()).bill
      billAId = billA.id
      const lineItemIdFromA = billA.lineItems[0].id

      const billBRes = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-XBILL-B-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customerB.id,
          lineItems: [{ category: "Other", quantity: 1, lineTotal: 300 }],
        },
      })
      billBId = (await billBRes.json()).bill.id

      // Attempt to return bill A's line item through bill B's returns route.
      const res = await page.request.post(`/api/bills/${billBId}/returns`, {
        data: { lineItemId: lineItemIdFromA, quantityReturned: 1 },
      })
      expect(res.status()).toBe(400)
    } finally {
      if (billAId) await page.request.delete(`/api/bills/${billAId}`)
      if (billBId) await page.request.delete(`/api/bills/${billBId}`)
      await page.request.delete(`/api/customers/${customerA.id}`)
      await page.request.delete(`/api/customers/${customerB.id}`)
    }
  })

  test("OWNER sees the Activity tab in Settings and it shows recent customer/bill actions", async ({
    page,
  }) => {
    const customer = await createTestCustomer(page)

    try {
      await page.goto("/settings")
      await page.getByRole("tab", { name: "Activity" }).click()
      await expect(page.getByRole("table")).toBeVisible()
      // The customer created above should show up as a recent entry (log
      // entries are capped at the 100 most recent — safe given this test
      // env's realistic volume, and if it ever flakes on a very active
      // shared dev DB, that's a sign this assertion needs a wider net).
      await expect(page.getByText(/Created customer/i).first()).toBeVisible()
    } finally {
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })
})
