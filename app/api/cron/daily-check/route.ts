import { NextResponse } from "next/server";

import {
  getBirthdaysThisWeek,
  getAnniversariesThisWeek,
  getInactiveCustomers,
  getTopSpenders,
} from "@/lib/queries/customer-lists";
import { getLowStockItems } from "@/lib/queries/inventory";
import { createNotificationIfNotExists } from "@/lib/queries/notifications";

/**
 * GET /api/cron/daily-check — meant to be hit once a day by Vercel Cron
 * (see vercel.json). Not gated by `requireRole` — a cron trigger has no
 * user session — instead gated by comparing an `Authorization: Bearer
 * <CRON_SECRET>` header against `process.env.CRON_SECRET` (set in `.env`
 * back in Stage 0).
 *
 * ## "Just crossed the threshold" approximation (inactive customers)
 * The `Customer` model has no stored "last known inactivity status," so
 * there's no exact way to detect the moment a customer's
 * `daysSinceLastVisit` crosses 30/60/90. This route approximates it: it
 * only notifies customers whose `daysSinceLastVisit` falls in a narrow
 * `[threshold, threshold + 2]` window (e.g. `[30, 32]` for the 30-day
 * tier). Since this route is expected to run once daily, a customer who
 * crossed the threshold "yesterday" is still caught within that window even
 * if a run gets missed for a day or two — but someone who's been inactive
 * for 45 days won't be re-notified daily forever, only around the moment
 * they crossed 30. This is a documented approximation, not exact
 * crossing-detection, which would need a stored per-customer "last notified
 * tier" field (a schema change, out of scope per the brief).
 *
 * ## VIP / top-spender notifications — simplification
 * A true "customer newly entered the top 10" detection would need a
 * historical snapshot of past top-10 membership, which doesn't exist and is
 * out of scope. Instead, every customer currently in `getTopSpenders(10)`
 * gets a `createNotificationIfNotExists` call each run — the 24h dedupe
 * window in `notifications.ts` (keyed as `vip-top10:<customerId>`) is what
 * actually prevents this from spamming the owner daily once a customer
 * settles into the top 10; it does NOT mean "this customer just entered the
 * top 10 today."
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let created = 0;
  let skipped = 0;

  async function notify(type: string, message: string) {
    const result = await createNotificationIfNotExists({ type, message });
    if (result.created) created++;
    else skipped++;
  }

  // --- Birthdays / anniversaries TODAY only (not the whole week) ---
  const [birthdays, anniversaries] = await Promise.all([
    getBirthdaysThisWeek(now),
    getAnniversariesThisWeek(now),
  ]);

  for (const entry of birthdays.filter((e) => e.daysUntil === 0)) {
    await notify(
      `birthday:${entry.customer.id}`,
      `🎂 It's ${entry.customer.name}'s birthday today! Consider sending a wish.`
    );
  }

  for (const entry of anniversaries.filter((e) => e.daysUntil === 0)) {
    await notify(
      `anniversary:${entry.customer.id}`,
      `💍 It's ${entry.customer.name}'s anniversary today! Consider sending a wish.`
    );
  }

  // --- Inactive-customer threshold crossing (approximated, see doc comment above) ---
  const INACTIVE_TIERS = [30, 60, 90] as const;
  for (const tier of INACTIVE_TIERS) {
    const inactive = await getInactiveCustomers(tier, now);
    const justCrossed = inactive.filter(
      (e) => e.daysSinceLastVisit !== null && e.daysSinceLastVisit >= tier && e.daysSinceLastVisit <= tier + 2
    );
    for (const entry of justCrossed) {
      await notify(
        `inactive-${tier}:${entry.customer.id}`,
        `${entry.customer.name} hasn't visited in over ${tier} days (last visit ${entry.daysSinceLastVisit} days ago).`
      );
    }
  }

  // --- Top spenders / VIP alert (simplified, see doc comment above) ---
  const topSpenders = await getTopSpenders(10);
  for (const customer of topSpenders) {
    await notify(
      `vip-top10:${customer.id}`,
      `⭐ ${customer.name} is currently a top-10 spender (₹${customer.totalPurchaseAmount.toLocaleString("en-IN")}).`
    );
  }

  // --- Low stock alert (Stage 20) — same simplification as VIP above: not
  // "just crossed the threshold," just "currently at or below it," with the
  // 24h dedupe window (keyed `low-stock:<itemId>`) doing the real work of
  // not re-notifying every single day while an item sits low. In-app
  // notification only — this app never sends WhatsApp automatically (see
  // the Campaigns page's own "nothing goes out automatically" note), and
  // low-stock alerts don't get a special exception to that rule.
  const lowStockItems = await getLowStockItems();
  for (const item of lowStockItems) {
    await notify(
      `low-stock:${item.id}`,
      `📦 ${item.name} is low on stock: ${item.quantity} left (threshold ${item.lowStockThreshold}).`
    );
  }

  return NextResponse.json({ ok: true, created, skipped, ranAt: now.toISOString() });
}
