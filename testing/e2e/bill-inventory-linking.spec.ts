import { test, expect, type Page } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs } from "./support/auth"

/**
 * Both the customer and the inventory item created in these tests are
 * throwaway rows this suite creates itself (unique timestamped
 * name/mobile), so creating, mutating, and deleting them in the same test
 * is safe — see testing/e2e/README.md rule #1's exception for self-created
 * rows. The bill created against them is likewise throwaway and deleted at
 * the end of every test.
 *
 * Bill creation now takes a `lineItems` "shopping cart" array (Stage 21)
 * rather than a flat category/amount/inventoryItemId/quantitySold shape —
 * every request body below reflects that.
 */

function uniqueMobile(): string {
  return `9${String(Date.now()).slice(-9)}`
}

async function createTestCustomer(page: Page): Promise<{ id: string }> {
  const res = await page.request.post("/api/customers", {
    data: { name: `E2E Bill-Inventory Customer ${Date.now()}`, mobileNumber: uniqueMobile() },
  })
  expect(res.ok(), `create customer failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  const body = await res.json()
  return { id: body.customer.id }
}

async function createTestItem(
  page: Page,
  quantity: number
): Promise<{ id: string; name: string }> {
  const name = `E2E Bill-Linked Item ${Date.now()}`
  const res = await page.request.post("/api/inventory", {
    data: { name, category: "Jewellery - Gold", quantity, lowStockThreshold: 2 },
  })
  expect(res.ok(), `create item failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  const body = await res.json()
  return { id: body.item.id, name }
}

async function getItemQuantity(page: Page, id: string): Promise<number> {
  const res = await page.request.get(`/api/inventory/${id}`)
  expect(res.status()).toBe(200)
  return (await res.json()).item.quantity
}

test.describe("Bill ↔ Inventory linking", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
  })

  test("a bill with no inventory link behaves exactly as before (regression)", async ({ page }) => {
    const customer = await createTestCustomer(page)
    let billId: string | undefined

    try {
      const res = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-NOLINK-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          lineItems: [{ category: "Beauty Services", quantity: 1, lineTotal: 500 }],
        },
      })
      expect(res.status()).toBe(201)
      const body = await res.json()
      expect(body.bill.lineItems[0].inventoryItemId).toBeFalsy()
      billId = body.bill.id
    } finally {
      if (billId) await page.request.delete(`/api/bills/${billId}`)
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })

  test("linking a bill to an item with sufficient stock decrements it atomically", async ({
    page,
  }) => {
    const customer = await createTestCustomer(page)
    const item = await createTestItem(page, 10)
    let billId: string | undefined

    try {
      const res = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-LINK-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          lineItems: [
            { category: "Jewellery - Gold", inventoryItemId: item.id, quantity: 3, unitPrice: 500 },
          ],
        },
      })
      expect(res.status()).toBe(201)
      const body = await res.json()
      expect(body.bill.lineItems[0].inventoryItemId).toBe(item.id)
      expect(body.bill.lineItems[0].quantity).toBe(3)
      billId = body.bill.id

      expect(await getItemQuantity(page, item.id)).toBe(7)
    } finally {
      if (billId) await page.request.delete(`/api/bills/${billId}`)
      await page.request.delete(`/api/inventory/${item.id}`)
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })

  test("two line items referencing the same item on one bill are aggregated before the stock check", async ({
    page,
  }) => {
    const customer = await createTestCustomer(page)
    const item = await createTestItem(page, 5)

    try {
      // 3 + 4 = 7 > 5 in stock — must be rejected as a combined request,
      // not wrongly allowed by checking "3 <= 5" and "4 <= 5" independently.
      const res = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-AGG-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          lineItems: [
            { category: "Jewellery - Gold", inventoryItemId: item.id, quantity: 3, unitPrice: 500 },
            { category: "Jewellery - Gold", inventoryItemId: item.id, quantity: 4, unitPrice: 500 },
          ],
        },
      })
      expect(res.status()).toBe(409)
      const body = await res.json()
      expect(body.reason).toBe("insufficient_stock")
      expect(await getItemQuantity(page, item.id)).toBe(5)
    } finally {
      await page.request.delete(`/api/inventory/${item.id}`)
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })

  test("overselling is rejected: bill not created, stock unchanged", async ({ page }) => {
    const customer = await createTestCustomer(page)
    const item = await createTestItem(page, 2)

    try {
      const res = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-OVERSELL-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          lineItems: [
            { category: "Jewellery - Gold", inventoryItemId: item.id, quantity: 5, unitPrice: 500 },
          ],
        },
      })
      expect(res.status()).toBe(409)
      const body = await res.json()
      expect(body.reason).toBe("insufficient_stock")

      // Stock must be completely unchanged — the failed bill must not have
      // partially decremented it.
      expect(await getItemQuantity(page, item.id)).toBe(2)

      // And no bill should have been created — the billNo must still be
      // free to use.
      const retryRes = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-OVERSELL-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          lineItems: [{ category: "Other", quantity: 1, lineTotal: 100 }],
        },
      })
      expect(retryRes.status()).toBe(201)
      const retryBillId = (await retryRes.json()).bill.id
      await page.request.delete(`/api/bills/${retryBillId}`)
    } finally {
      await page.request.delete(`/api/inventory/${item.id}`)
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })

  test("deleting a linked bill restores the item's stock", async ({ page }) => {
    const customer = await createTestCustomer(page)
    const item = await createTestItem(page, 10)

    try {
      const createRes = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-RESTORE-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          lineItems: [
            { category: "Jewellery - Gold", inventoryItemId: item.id, quantity: 4, unitPrice: 1250 },
          ],
        },
      })
      expect(createRes.status()).toBe(201)
      const billId = (await createRes.json()).bill.id
      expect(await getItemQuantity(page, item.id)).toBe(6)

      const deleteRes = await page.request.delete(`/api/bills/${billId}`)
      expect(deleteRes.status()).toBe(200)

      expect(await getItemQuantity(page, item.id)).toBe(10)
    } finally {
      await page.request.delete(`/api/inventory/${item.id}`)
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })

  test("linking a nonexistent inventory item is rejected with 404, no bill created", async ({
    page,
  }) => {
    const customer = await createTestCustomer(page)

    try {
      const res = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-NOITEM-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          lineItems: [
            {
              category: "Jewellery - Gold",
              inventoryItemId: "nonexistent-inventory-item-id",
              quantity: 1,
              unitPrice: 100,
            },
          ],
        },
      })
      expect(res.status()).toBe(404)
    } finally {
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })
})
