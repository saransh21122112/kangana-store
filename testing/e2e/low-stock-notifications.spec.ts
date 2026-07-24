import { test, expect, type Page } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs } from "./support/auth"

const CRON_SECRET = process.env.CRON_SECRET

test.skip(!CRON_SECRET, "CRON_SECRET not set in .env — see testing/e2e/README.md")

interface NotificationDTO {
  id: string
  type: string
  message: string
}

async function callCron(page: Page) {
  return page.request.get("/api/cron/daily-check", {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
}

async function findNotificationsByType(page: Page, type: string): Promise<NotificationDTO[]> {
  const res = await page.request.get("/api/notifications")
  expect(res.status()).toBe(200)
  const { notifications } = (await res.json()) as { notifications: NotificationDTO[] }
  return notifications.filter((n) => n.type === type)
}

test.describe("Low-stock cron notifications", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
  })

  test("cron rejects a missing/wrong bearer token", async ({ page }) => {
    const res = await page.request.get("/api/cron/daily-check", {
      headers: { Authorization: "Bearer wrong-secret" },
    })
    expect(res.status()).toBe(401)
  })

  test("creates exactly one low-stock notification per item, deduped on a second run", async ({
    page,
  }) => {
    // The real cron route walks every birthday/anniversary/inactive-tier/
    // top-spender/low-stock candidate with a sequential per-row dedupe
    // check against Neon (observed elsewhere in this project to have
    // 2-3s round-trip latency) — calling it twice plus setup/cleanup
    // routinely exceeds the default 30s test timeout even with nothing
    // wrong. This is the real, pre-existing performance profile of that
    // route, not something to paper over by trimming what the test does.
    test.setTimeout(90_000)

    const itemName = `E2E Low Stock Cron ${Date.now()}`
    const createRes = await page.request.post("/api/inventory", {
      data: { name: itemName, category: "Makeup", quantity: 1, lowStockThreshold: 5 },
    })
    expect(createRes.status()).toBe(201)
    const item = (await createRes.json()).item
    const notificationType = `low-stock:${item.id}`

    try {
      const firstRun = await callCron(page)
      expect(firstRun.status()).toBe(200)
      const firstBody = await firstRun.json()
      expect(firstBody.ok).toBe(true)

      const afterFirst = await findNotificationsByType(page, notificationType)
      expect(afterFirst).toHaveLength(1)
      expect(afterFirst[0].message).toContain(itemName)
      expect(afterFirst[0].message).toContain("1 left")

      const secondRun = await callCron(page)
      expect(secondRun.status()).toBe(200)

      // Same 24h dedupe window as birthdays/inactive-customers/VIP — a
      // second run within the window must not create a duplicate row.
      const afterSecond = await findNotificationsByType(page, notificationType)
      expect(afterSecond).toHaveLength(1)
      expect(afterSecond[0].id).toBe(afterFirst[0].id)
    } finally {
      await page.request.delete(`/api/inventory/${item.id}`)
    }
  })

  test("a well-stocked item never gets a low-stock notification", async ({ page }) => {
    const itemName = `E2E Well Stocked Cron ${Date.now()}`
    const createRes = await page.request.post("/api/inventory", {
      data: { name: itemName, category: "Makeup", quantity: 500, lowStockThreshold: 5 },
    })
    expect(createRes.status()).toBe(201)
    const item = (await createRes.json()).item

    try {
      const run = await callCron(page)
      expect(run.status()).toBe(200)

      const found = await findNotificationsByType(page, `low-stock:${item.id}`)
      expect(found).toHaveLength(0)
    } finally {
      await page.request.delete(`/api/inventory/${item.id}`)
    }
  })
})
