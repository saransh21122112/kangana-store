import { PDFParse } from "pdf-parse"
import { test, expect, type Page } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs } from "./support/auth"

function uniqueMobile(): string {
  return `9${String(Date.now()).slice(-9)}`
}

async function createTestCustomer(page: Page): Promise<{ id: string }> {
  const res = await page.request.post("/api/customers", {
    data: { name: `E2E PDF Customer ${Date.now()}`, mobileNumber: uniqueMobile() },
  })
  expect(res.ok(), `create customer failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  const body = await res.json()
  return { id: body.customer.id }
}

test.describe("Bill PDF download", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
  })

  test("download link on /bills returns a real PDF with correct headers", async ({ page }) => {
    await page.goto("/bills")
    const firstDownload = page.locator('a[aria-label="Download bill as PDF"]').first()
    await expect(firstDownload).toBeVisible()
    const href = await firstDownload.getAttribute("href")
    expect(href).toMatch(/^\/api\/bills\/.+\/pdf$/)

    const res = await page.request.get(href!)
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toBe("application/pdf")
    expect(res.headers()["content-disposition"]).toMatch(/^attachment; filename="bill-.+\.pdf"$/)

    const body = await res.body()
    expect(body.byteLength).toBeGreaterThan(1000)
    expect(body.subarray(0, 5).toString("utf-8")).toBe("%PDF-")
  })

  test("clicking the button triggers a real browser download", async ({ page }) => {
    await page.goto("/bills")
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('a[aria-label="Download bill as PDF"]').first().click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^bill-.+\.pdf$/)
  })

  test("the rupee amount renders as 'Rs.' text, not a mangled glyph (regression)", async ({
    page,
  }) => {
    await page.goto("/bills")
    const href = await page.locator('a[aria-label="Download bill as PDF"]').first().getAttribute("href")
    const res = await page.request.get(href!)
    const buf = await res.body()

    // @react-pdf/renderer draws text as hex-encoded glyph indices into a
    // subset font (e.g. `[<52> 0 <73> ...] TJ`), not literal ASCII — a raw
    // byte-string search for "Rs." doesn't work (an earlier version of this
    // test made that mistake). `pdf-parse` resolves the font's encoding
    // table properly, the same way a real PDF viewer would.
    const parser = new PDFParse({ data: buf })
    const { text } = await parser.getText()
    await parser.destroy()

    // The original bug (Intl's ₹ glyph on a base font with no glyph for it)
    // never produced the substring "Rs." anywhere in the extracted text —
    // it produced a different, mangled character instead.
    expect(text).toContain("Rs.")
    expect(text).toMatch(/Rs\.\s*[\d,]+/)
  })

  test("a bill with many line items paginates, and the footer repeats on every page (regression)", async ({
    page,
  }) => {
    // Regression test for a real bug: the footer Text wasn't marked `fixed`,
    // so on a bill long enough to overflow onto a second A5 page it would
    // only render on whichever page @react-pdf/renderer's auto-pagination
    // happened to place it on, not on every page. 40 line items reliably
    // overflows a single A5 page's table area.
    test.setTimeout(60_000)

    const customer = await createTestCustomer(page)
    let billId: string | undefined

    try {
      const lineItems = Array.from({ length: 40 }, (_, i) => ({
        category: "Other",
        quantity: 1,
        lineTotal: 100 + i,
      }))
      const billRes = await page.request.post("/api/bills", {
        data: {
          billNo: `E2E-PDF-PAGINATE-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          lineItems,
        },
      })
      expect(billRes.status()).toBe(201)
      billId = (await billRes.json()).bill.id

      const res = await page.request.get(`/api/bills/${billId}/pdf`)
      expect(res.status()).toBe(200)
      const buf = await res.body()

      const parser = new PDFParse({ data: buf })
      const { pages, total } = await parser.getText()
      await parser.destroy()

      expect(total).toBeGreaterThan(1)
      for (const p of pages) {
        expect(p.text, `page ${p.num} is missing the footer`).toContain(
          "Thank you for shopping"
        )
      }
    } finally {
      if (billId) await page.request.delete(`/api/bills/${billId}`)
      await page.request.delete(`/api/customers/${customer.id}`)
    }
  })
})
