import { test, expect, type Page } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs, logout } from "./support/auth"
import { createTestUser, deleteTestUser, type TestUser } from "./support/test-users"

/**
 * Unlike the customer/bill delete-flow tests (testing/e2e/delete-flows.
 * spec.ts, which must NEVER complete a real deletion — see the README's
 * rule #1), inventory items created by these tests ARE safe to actually
 * delete: they're new rows this suite creates itself with a unique,
 * timestamped name, not pre-existing store data. Every item created here is
 * deleted in an `afterEach`/`afterAll`, same guarantee-even-on-failure
 * pattern as the throwaway test users in support/test-users.ts.
 */

interface TestItem {
  id: string
  name: string
}

async function createItem(
  page: Page,
  overrides: Partial<{ name: string; category: string; quantity: number; lowStockThreshold: number }> = {}
): Promise<TestItem> {
  const name = overrides.name ?? `E2E Test Item ${Date.now()}`
  const res = await page.request.post("/api/inventory", {
    data: {
      name,
      category: overrides.category ?? "Makeup",
      quantity: overrides.quantity ?? 10,
      lowStockThreshold: overrides.lowStockThreshold ?? 5,
    },
  })
  expect(res.ok(), `create item failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  const body = await res.json()
  return { id: body.item.id, name }
}

async function deleteItem(page: Page, id: string): Promise<void> {
  const res = await page.request.delete(`/api/inventory/${id}`)
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`Failed to delete test item ${id}: ${res.status()} ${await res.text()}`)
  }
}

test.describe("Inventory — API CRUD (OWNER)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
  })

  test("create, read, update, adjust stock, delete — full lifecycle", async ({ page }) => {
    const item = await createItem(page, { quantity: 10, lowStockThreshold: 5 })

    const getRes = await page.request.get(`/api/inventory/${item.id}`)
    expect(getRes.status()).toBe(200)
    const got = (await getRes.json()).item
    expect(got.name).toBe(item.name)
    expect(got.quantity).toBe(10)

    const patchRes = await page.request.patch(`/api/inventory/${item.id}`, {
      data: { category: "Skincare" },
    })
    expect(patchRes.status()).toBe(200)
    expect((await patchRes.json()).item.category).toBe("Skincare")

    const adjustDownRes = await page.request.post(`/api/inventory/${item.id}/adjust`, {
      data: { delta: -3 },
    })
    expect(adjustDownRes.status()).toBe(200)
    expect((await adjustDownRes.json()).item.quantity).toBe(7)

    const adjustUpRes = await page.request.post(`/api/inventory/${item.id}/adjust`, {
      data: { delta: 5 },
    })
    expect(adjustUpRes.status()).toBe(200)
    expect((await adjustUpRes.json()).item.quantity).toBe(12)

    const deleteRes = await page.request.delete(`/api/inventory/${item.id}`)
    expect(deleteRes.status()).toBe(200)

    const getAfterDelete = await page.request.get(`/api/inventory/${item.id}`)
    expect(getAfterDelete.status()).toBe(404)
  })

  test("stock quantity clamps at 0, never goes negative", async ({ page }) => {
    const item = await createItem(page, { quantity: 2 })

    const res = await page.request.post(`/api/inventory/${item.id}/adjust`, {
      data: { delta: -10 },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).item.quantity).toBe(0)

    await deleteItem(page, item.id)
  })

  test("getAllInventoryItems filters by category and low-stock", async ({ page }) => {
    const lowStock = await createItem(page, {
      name: `E2E Low Stock ${Date.now()}`,
      category: "Jewellery - Gold",
      quantity: 1,
      lowStockThreshold: 5,
    })
    const wellStocked = await createItem(page, {
      name: `E2E Well Stocked ${Date.now()}`,
      category: "Jewellery - Gold",
      quantity: 50,
      lowStockThreshold: 5,
    })

    const categoryRes = await page.request.get("/api/inventory?category=Jewellery - Gold")
    expect(categoryRes.status()).toBe(200)
    const categoryItems = (await categoryRes.json()).items
    const categoryNames = categoryItems.map((i: { name: string }) => i.name)
    expect(categoryNames).toContain(lowStock.name)
    expect(categoryNames).toContain(wellStocked.name)

    const lowStockRes = await page.request.get("/api/inventory?lowStockOnly=true")
    expect(lowStockRes.status()).toBe(200)
    const lowStockNames = (await lowStockRes.json()).items.map((i: { name: string }) => i.name)
    expect(lowStockNames).toContain(lowStock.name)
    expect(lowStockNames).not.toContain(wellStocked.name)

    await deleteItem(page, lowStock.id)
    await deleteItem(page, wellStocked.id)
  })
})

test.describe("Inventory — page renders (OWNER)", () => {
  test("inventory page loads with no console errors and shows a created item", async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    const item = await createItem(page)

    const errors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text())
    })
    page.on("pageerror", (err) => errors.push(err.message))

    // Scoped by `?search=` — the page caps its unfiltered listing at 200
    // rows (the store's real catalog has ~5,300 bulk-imported items), so a
    // freshly created item with a random/timestamped name has no guarantee
    // of landing in that first alphabetical page without narrowing down to
    // it directly, the same way a real user would find it.
    await page.goto(`/inventory?search=${encodeURIComponent(item.name)}`)
    await expect(page.getByText(item.name)).toBeVisible()
    expect(errors, `console errors on /inventory:\n${errors.join("\n")}`).toEqual([])

    await deleteItem(page, item.id)
  })

  test("Inventory nav link is present and navigates correctly", async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.goto("/")
    await page.locator("aside").getByRole("link", { name: "Inventory" }).click()
    await expect(page).toHaveURL(/\/inventory$/)
  })
})

test.describe("Inventory — role gating", () => {
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

  test("STAFF can create and adjust stock, but not delete", async ({ page }) => {
    await loginAs(page, staffUser.email, staffUser.password)

    const createRes = await page.request.post("/api/inventory", {
      data: { name: `E2E Staff Item ${Date.now()}`, category: "Makeup", quantity: 5, lowStockThreshold: 2 },
    })
    expect(createRes.status()).toBe(201)
    const item = (await createRes.json()).item

    const adjustRes = await page.request.post(`/api/inventory/${item.id}/adjust`, {
      data: { delta: 1 },
    })
    expect(adjustRes.status()).toBe(200)

    const deleteRes = await page.request.delete(`/api/inventory/${item.id}`)
    expect(deleteRes.status()).toBe(403)

    await logout(page)

    // Clean up with OWNER since STAFF can't delete.
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await deleteItem(page, item.id)
  })

  test("VIEWER can read but every mutation 403s, and no mutation UI renders", async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    const item = await createItem(page)
    await logout(page)

    await loginAs(page, viewerUser.email, viewerUser.password)

    const getRes = await page.request.get("/api/inventory")
    expect(getRes.status()).toBe(200)

    const createRes = await page.request.post("/api/inventory", {
      data: { name: "should not be created", category: "Makeup", quantity: 1, lowStockThreshold: 1 },
    })
    expect(createRes.status()).toBe(403)

    const patchRes = await page.request.patch(`/api/inventory/${item.id}`, {
      data: { category: "Other" },
    })
    expect(patchRes.status()).toBe(403)

    const adjustRes = await page.request.post(`/api/inventory/${item.id}/adjust`, {
      data: { delta: 1 },
    })
    expect(adjustRes.status()).toBe(403)

    const deleteRes = await page.request.delete(`/api/inventory/${item.id}`)
    expect(deleteRes.status()).toBe(403)

    await page.goto("/inventory")
    for (const label of ["Add Item", "Add Inventory Item", "New Item"]) {
      await expect(page.getByRole("button", { name: label })).toHaveCount(0)
    }

    await logout(page)
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await deleteItem(page, item.id)
  })
})
