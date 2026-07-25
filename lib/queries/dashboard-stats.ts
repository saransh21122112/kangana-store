import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_SALES_WINDOW_DAYS = 30;

/** Midnight (00:00:00.000) of `from`'s calendar day, in local time. */
function startOfDay(from: Date): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
}

/** Start of `from`'s calendar month, 00:00 on the 1st, in local time. */
function startOfMonth(from: Date): Date {
  return new Date(from.getFullYear(), from.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * `[start, end)` for a rolling `windowDays`-day window ending today
 * (inclusive of today). Exported so callers needing more than one
 * query scoped to "the same N-day window" (e.g. the Reports page's
 * period filter driving the daily-sales chart, category donut, and top
 * spenders table all at once) use identical boundaries rather than each
 * recomputing its own and risking an off-by-one mismatch between them.
 */
export function getDaysWindow(windowDays: number, from: Date = new Date()): { start: Date; end: Date } {
  const todayStart = startOfDay(from);
  return {
    start: new Date(todayStart.getTime() - (windowDays - 1) * DAY_MS),
    end: new Date(todayStart.getTime() + DAY_MS),
  };
}

/**
 * Count of distinct customers who have at least one `Bill` dated today
 * (local calendar day, [00:00, tomorrow 00:00)).
 */
export async function getTodaysCustomerCount(from: Date = new Date()): Promise<number> {
  const dayStart = startOfDay(from);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  const bills = await prisma.bill.findMany({
    where: { date: { gte: dayStart, lt: dayEnd } },
    select: { customerId: true },
    distinct: ["customerId"],
  });

  return bills.length;
}

export type SalesPeriod = "today" | "month" | "90days" | "6months" | "year";

/** `from` shifted back by a calendar number of months, same day-of-month
 * (clamped by `Date`'s own month-overflow rollover — acceptable here since
 * these are wide rolling windows, not exact billing-cycle boundaries). */
function monthsAgo(from: Date, months: number): Date {
  return new Date(from.getFullYear(), from.getMonth() - months, from.getDate(), 0, 0, 0, 0);
}

/**
 * Sum of `Bill.amount` for the given rolling/calendar period, relative to
 * `from`: "today" (local calendar day), "month" (local calendar month to
 * date), "90days"/"year" (rolling N-day/1-year windows ending today),
 * "6months" (rolling 6-calendar-month window ending today).
 */
export async function getTotalSales(period: SalesPeriod, from: Date = new Date()): Promise<number> {
  const end = new Date(from.getTime() + 1);
  let start: Date;
  switch (period) {
    case "today":
      start = startOfDay(from);
      break;
    case "month":
      start = startOfMonth(from);
      break;
    case "90days":
      start = new Date(startOfDay(from).getTime() - 89 * DAY_MS);
      break;
    case "6months":
      start = monthsAgo(from, 6);
      break;
    case "year":
      start = monthsAgo(from, 12);
      break;
  }

  const result = await prisma.bill.aggregate({
    where: { date: { gte: start, lt: end } },
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}

/** Sum of `Bill.amount` across every bill ever recorded — no date filter. */
export async function getAllTimeTotalSales(): Promise<number> {
  const result = await prisma.bill.aggregate({ _sum: { amount: true } });
  return result._sum.amount ?? 0;
}

/** Count of customers with more than one recorded visit (repeat customers). */
export async function getRepeatCustomerCount(): Promise<number> {
  return prisma.customer.count({ where: { totalVisits: { gt: 1 } } });
}

/**
 * Store-wide average bill value: total sum of all bill amounts divided by
 * the total count of all bills across the whole store. This is more
 * correct than averaging each customer's `averageBillValue` (which would
 * weight every customer equally regardless of how many bills they have).
 */
export async function getStoreAverageBillValue(): Promise<number> {
  const result = await prisma.bill.aggregate({
    _sum: { amount: true },
    _count: true,
  });

  const total = result._sum.amount ?? 0;
  const count = result._count;
  return count > 0 ? total / count : 0;
}

export interface DailySales {
  /** "YYYY-MM-DD", local calendar day. */
  date: string;
  total: number;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Daily sales totals for the last `windowDays` days (including today),
 * oldest first. Every day in the window gets an entry, even if it has zero
 * sales — a chart with skipped/missing days would look wrong (gaps read as
 * "no data" rather than "zero").
 */
export async function getDailySalesForDays(
  windowDays: number,
  from: Date = new Date()
): Promise<DailySales[]> {
  const { start: windowStart, end: windowEnd } = getDaysWindow(windowDays, from);

  const bills = await prisma.bill.findMany({
    where: { date: { gte: windowStart, lt: windowEnd } },
    select: { date: true, amount: true },
  });

  const totals = new Map<string, number>();
  for (const bill of bills) {
    const key = toDateKey(bill.date);
    totals.set(key, (totals.get(key) ?? 0) + bill.amount);
  }

  const days: DailySales[] = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(windowStart.getTime() + i * DAY_MS);
    const key = toDateKey(d);
    days.push({ date: key, total: totals.get(key) ?? 0 });
  }

  return days;
}

/** Daily sales for the last 30 days — thin wrapper over
 * `getDailySalesForDays` kept for the Dashboard page's fixed 30-day chart. */
export async function getDailySalesLast30Days(from: Date = new Date()): Promise<DailySales[]> {
  return getDailySalesForDays(DAILY_SALES_WINDOW_DAYS, from);
}

export interface CategorySales {
  category: string;
  total: number;
}

/** Sales summed by `BillLineItem.category`, descending by total, for a
 * donut chart. Grouped by line item (not `Bill.category`, which no longer
 * represents a whole bill's category now that bills hold multiple line
 * items) so this reflects real per-item categories. All-time — no date
 * filter — used by the Dashboard's fixed donut; the Reports page uses
 * `getSalesByCategoryInRange` below instead so its donut moves with the
 * page's period filter. */
export async function getSalesByCategory(): Promise<CategorySales[]> {
  const grouped = await prisma.billLineItem.groupBy({
    by: ["category"],
    _sum: { lineTotal: true },
  });

  return grouped
    .map((g) => ({ category: g.category, total: g._sum.lineTotal ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Same as `getSalesByCategory`, scoped to line items whose owning bill's
 * `date` falls within `[start, end)`. `BillLineItem` has no `date` of its
 * own (it inherits its bill's), hence the `bill: { date: ... }` filter. */
export async function getSalesByCategoryInRange(start: Date, end: Date): Promise<CategorySales[]> {
  const grouped = await prisma.billLineItem.groupBy({
    by: ["category"],
    where: { bill: { date: { gte: start, lt: end } } },
    _sum: { lineTotal: true },
  });

  return grouped
    .map((g) => ({ category: g.category, total: g._sum.lineTotal ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

export interface TopSellingItem {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  totalRevenue: number;
  totalQuantity: number;
}

/**
 * Top `limit` `InventoryItem`s by revenue within `[start, end)`, summed
 * across every `BillLineItem` that references them. Line items with no
 * `inventoryItemId` (ad-hoc/manual entries not tied to the catalog) are
 * excluded — there's no item identity to group them by. Same
 * groupBy-then-hydrate shape as `getTopSpendersInRange` in
 * `lib/queries/customer-lists.ts`.
 */
export async function getTopSellingItemsInRange(
  start: Date,
  end: Date,
  limit = 10
): Promise<TopSellingItem[]> {
  const grouped = await prisma.billLineItem.groupBy({
    by: ["inventoryItemId"],
    where: { inventoryItemId: { not: null }, bill: { date: { gte: start, lt: end } } },
    _sum: { lineTotal: true, quantity: true },
    orderBy: { _sum: { lineTotal: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const ids = grouped.map((g) => g.inventoryItemId as string);
  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, brand: true, category: true },
  });
  const byId = new Map(items.map((i) => [i.id, i]));

  return grouped
    .map((g) => {
      const item = byId.get(g.inventoryItemId as string);
      if (!item) return null;
      return {
        ...item,
        totalRevenue: g._sum.lineTotal ?? 0,
        totalQuantity: g._sum.quantity ?? 0,
      };
    })
    .filter((row): row is TopSellingItem => row !== null);
}

export interface DashboardStats {
  todaysCustomerCount: number;
  totalSalesToday: number;
  totalSalesMonth: number;
  totalSales90Days: number;
  totalSales6Months: number;
  totalSalesYear: number;
  allTimeTotalSales: number;
  repeatCustomerCount: number;
  storeAverageBillValue: number;
  dailySales: DailySales[];
  salesByCategory: CategorySales[];
}

/**
 * Combined fetch of every dashboard-stats query, for the dashboard page to
 * consume in one call. Birthdays/anniversaries/inactive-customer data is
 * deliberately NOT included here — the dashboard page fetches those
 * directly from `lib/queries/customer-lists.ts` to avoid reimplementing
 * that logic.
 */
export async function getDashboardStats(from: Date = new Date()): Promise<DashboardStats> {
  const [
    todaysCustomerCount,
    totalSalesToday,
    totalSalesMonth,
    totalSales90Days,
    totalSales6Months,
    totalSalesYear,
    allTimeTotalSales,
    repeatCustomerCount,
    storeAverageBillValue,
    dailySales,
    salesByCategory,
  ] = await Promise.all([
    getTodaysCustomerCount(from),
    getTotalSales("today", from),
    getTotalSales("month", from),
    getTotalSales("90days", from),
    getTotalSales("6months", from),
    getTotalSales("year", from),
    getAllTimeTotalSales(),
    getRepeatCustomerCount(),
    getStoreAverageBillValue(),
    getDailySalesLast30Days(from),
    getSalesByCategory(),
  ]);

  return {
    todaysCustomerCount,
    totalSalesToday,
    totalSalesMonth,
    totalSales90Days,
    totalSales6Months,
    totalSalesYear,
    allTimeTotalSales,
    repeatCustomerCount,
    storeAverageBillValue,
    dailySales,
    salesByCategory,
  };
}
