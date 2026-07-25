import { test, expect, type Page } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs } from "./support/auth"

/**
 * Regression coverage for a real bug, reported directly: the Reports
 * page's category donut and top-spenders table were all-time totals with
 * no date bound at all, silently mismatched against the "last 30 days"
 * framing the rest of the page implied. Fixed by adding a `?period=`
 * filter (30/60/90/365 days) that every section is now fetched against
 * using the exact same `[start, end)` window (`getDaysWindow`).
 *
 * The customer/bill created here are throwaway rows this suite creates
 * itself (unique timestamped name/mobile/billNo), safe to create and
 * delete per testing/e2e/README.md rule #1's exception. A bill dated 45
 * days ago is the key fixture: it must count toward the 60-day headline
 * total but not the 30-day one — that's the exact "different window,
 * different numbers" behavior the bug report was about. The assertion
 * uses "the 60-day total is at least ₹222 more than the 30-day total"
 * (not exact equality) since real seed data may also have bills in the
 * 31-60-day range — this fixture bill is only guaranteed to be a *lower
 * bound* on that delta, not the whole of it.
 */

function uniqueMobile(): string {
  return `9${String(Date.now()).slice(-9)}`
}

function daysAgoIsoDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * Reads the headline "Total Sales — {label}" StatTile's value specifically
 * — not just the first "₹..." text on the page, since the Top Spenders
 * table below it renders values in the same "₹1,234" shape and a loose
 * text-regex match could grab the wrong one.
 */
async function readHeadlineTotal(page: Page, label: string): Promise<number> {
  const container = page.getByText(`Total Sales — ${label}`, { exact: true }).locator("..")
  const text = await container.locator("span").nth(1).innerText()
  return Number(text.replace(/[₹,]/g, ""))
}

test.describe("Reports page period filter", () => {
  let customerId: string
  let oldBillId: string

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)

    const customerRes = await page.request.post("/api/customers", {
      data: { name: `E2E Reports-Period Customer ${Date.now()}`, mobileNumber: uniqueMobile() },
    })
    expect(customerRes.ok()).toBeTruthy()
    customerId = (await customerRes.json()).customer.id

    // Dated 45 days ago — must count toward the 60/90/365-day headline
    // totals, but NOT the 30-day one.
    const oldRes = await page.request.post("/api/bills", {
      data: {
        billNo: `E2E-REPORTS-OLD-${Date.now()}`,
        date: daysAgoIsoDate(45),
        customerId,
        lineItems: [{ category: "Makeup", quantity: 1, lineTotal: 222 }],
      },
    })
    expect(oldRes.ok()).toBeTruthy()
    oldBillId = (await oldRes.json()).bill.id

    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.request.delete(`/api/bills/${oldBillId}`)
    await page.request.delete(`/api/customers/${customerId}`)
    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
  })

  test("switching the period filter changes the headline, chart, donut, and top-spenders labels together", async ({
    page,
  }) => {
    await page.goto("/reports?period=30")
    await expect(page.getByRole("tab", { name: "30 Days", selected: true })).toBeVisible()
    const total30 = await readHeadlineTotal(page, "30 Days")

    await page.getByRole("tab", { name: "60 Days" }).click()
    await expect(page).toHaveURL(/period=60/)
    await expect(page.getByText("Total Sales — 60 Days")).toBeVisible()
    await expect(page.getByText("Daily Sales (60 Days)")).toBeVisible()
    await expect(page.getByText("Sales by Category (60 Days)")).toBeVisible()
    await expect(page.getByText("Top Spenders (60 Days)")).toBeVisible()
    const total60 = await readHeadlineTotal(page, "60 Days")

    // The 45-day-old ₹222 bill is in-window for 60 days but not 30 —
    // the 60-day total must be at least ₹222 higher.
    expect(total60).toBeGreaterThanOrEqual(total30 + 222)

    await page.getByRole("tab", { name: "This Year" }).click()
    await expect(page).toHaveURL(/period=365/)
    await expect(page.getByText("Total Sales — This Year")).toBeVisible()
    const total365 = await readHeadlineTotal(page, "This Year")
    expect(total365).toBeGreaterThanOrEqual(total60)
  })
})
