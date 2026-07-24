import { PDFParse } from "pdf-parse"
import { test, expect } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs } from "./support/auth"

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
})
