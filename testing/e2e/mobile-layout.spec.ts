import { test, expect } from "@playwright/test"
import { OWNER_EMAIL, OWNER_PASSWORD } from "./support/env"
import { loginAs } from "./support/auth"

/**
 * `SegmentedControl` used to render as a plain `inline-flex` row with no
 * overflow handling, so a control with 5+ options or long labels (Settings'
 * 5 tabs, `/lists`' view switcher) was wider than a narrow phone screen. On
 * a real iPhone (confirmed via a user-supplied screenshot) tapping an
 * off-screen tab triggered the browser's native "scroll the focused element
 * into view" behavior; with no scrollable ancestor to absorb it, this
 * escaped all the way up and shifted the *entire page* horizontally,
 * cutting off every other element (headings, cards, form fields all
 * partially off-screen). Fixed by wrapping `SegmentedControl` in its own
 * `overflow-x-auto` container, which gives that native scroll-into-view
 * behavior a nearby scrollable ancestor to stop at instead of escalating.
 *
 * This exact focus-scroll behavior is WebKit/iOS-specific — the first two
 * tests below (page never overflows horizontally, a general invariant
 * worth guarding regardless) pass even against the unfixed code when run
 * under Chromium, since Chromium doesn't reproduce that particular
 * scroll-into-view escalation. The third test is the one that actually
 * exercises the fix: confirmed to fail against the pre-fix component
 * (scrolling the wrapper does nothing when the wrapper isn't scrollable)
 * and pass against the fixed one.
 */
test.describe("Mobile layout — no page-level horizontal overflow", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
  })

  async function pageOverflowsHorizontally(page: import("@playwright/test").Page) {
    return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  }

  test("/settings does not overflow horizontally (5-tab SegmentedControl)", async ({ page }) => {
    await page.goto("/settings")
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
    expect(await pageOverflowsHorizontally(page)).toBe(false)
  })

  test("/lists does not overflow horizontally (5-option view switcher)", async ({ page }) => {
    await page.goto("/lists")
    await expect(page.getByRole("heading", { name: "Lists" })).toBeVisible()
    expect(await pageOverflowsHorizontally(page)).toBe(false)
  })

  test("the Settings tab strip itself scrolls horizontally to reach off-screen tabs", async ({
    page,
  }) => {
    await page.goto("/settings")
    const scrollContainer = page.locator(".no-scrollbar").first()

    await expect(page.getByRole("tab", { name: "Activity" })).not.toBeInViewport()
    await scrollContainer.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
    })
    await expect(page.getByRole("tab", { name: "Activity" })).toBeInViewport()
  })
})
