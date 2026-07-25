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

export type SalesPeriod = "today" | "month";

/**
 * Sum of `Bill.amount` for the given period ("today" = local calendar day,
 * "month" = local calendar month to date), relative to `from`.
 */
export async function getTotalSales(period: SalesPeriod, from: Date = new Date()): Promise<number> {
  const start = period === "today" ? startOfDay(from) : startOfMonth(from);
  const end = period === "today" ? new Date(start.getTime() + DAY_MS) : new Date(from.getTime() + 1);

  const result = await prisma.bill.aggregate({
    where: { date: { gte: start, lt: end } },
    _sum: { amount: true },
  });

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
 * Daily sales totals for the last 30 days (including today), oldest first.
 * Every day in the window gets an entry, even if it has zero sales — a
 * chart with skipped/missing days would look wrong (gaps read as "no
 * data" rather than "zero").
 */
export async function getDailySalesLast30Days(from: Date = new Date()): Promise<DailySales[]> {
  const todayStart = startOfDay(from);
  const windowStart = new Date(
    todayStart.getTime() - (DAILY_SALES_WINDOW_DAYS - 1) * DAY_MS
  );
  const windowEnd = new Date(todayStart.getTime() + DAY_MS);

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
  for (let i = 0; i < DAILY_SALES_WINDOW_DAYS; i++) {
    const d = new Date(windowStart.getTime() + i * DAY_MS);
    const key = toDateKey(d);
    days.push({ date: key, total: totals.get(key) ?? 0 });
  }

  return days;
}

export interface CategorySales {
  category: string;
  total: number;
}

/** Sales summed by `BillLineItem.category`, descending by total, for a
 * donut chart. Grouped by line item (not `Bill.category`, which no longer
 * represents a whole bill's category now that bills hold multiple line
 * items) so this reflects real per-item categories. */
export async function getSalesByCategory(): Promise<CategorySales[]> {
  const grouped = await prisma.billLineItem.groupBy({
    by: ["category"],
    _sum: { lineTotal: true },
  });

  return grouped
    .map((g) => ({ category: g.category, total: g._sum.lineTotal ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

export interface DashboardStats {
  todaysCustomerCount: number;
  totalSalesToday: number;
  totalSalesMonth: number;
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
    repeatCustomerCount,
    storeAverageBillValue,
    dailySales,
    salesByCategory,
  ] = await Promise.all([
    getTodaysCustomerCount(from),
    getTotalSales("today", from),
    getTotalSales("month", from),
    getRepeatCustomerCount(),
    getStoreAverageBillValue(),
    getDailySalesLast30Days(from),
    getSalesByCategory(),
  ]);

  return {
    todaysCustomerCount,
    totalSalesToday,
    totalSalesMonth,
    repeatCustomerCount,
    storeAverageBillValue,
    dailySales,
    salesByCategory,
  };
}
