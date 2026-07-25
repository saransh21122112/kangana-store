import { prisma } from "@/lib/prisma";
import type { Customer } from "@/lib/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days from `from` (default: now) until the next occurrence of `date`'s
 * month+day, ignoring year — i.e. treats `date` as a yearly-recurring event
 * (birthday/anniversary). Always returns a value in `[0, 365]`.
 *
 * Implementation note on the Dec→Jan wraparound: rather than subtracting
 * raw `Date` objects (which breaks when the recurring month/day is
 * "earlier in the calendar" than `from`, e.g. today is Dec 29 and the
 * event is Jan 2), we build the candidate occurrence in `from`'s own year
 * and, if that's already in the past relative to `from`, roll it forward
 * to `from`'s year + 1. That's equivalent to modular arithmetic over a
 * ~365-day cycle without the leap-year bookkeeping a literal `% 366` would
 * require, and it's exact because both `next` and `fromMidnight` are
 * constructed via `Date.UTC`, which normalizes out-of-range month/day
 * components consistently.
 *
 * Known limitation: a Feb 29 birthday, in a non-leap `from`-year, resolves
 * via `Date.UTC`'s normalization to Mar 1 of that year. This is an
 * accepted edge case for a small boutique CRM's birthday/anniversary
 * reminders, not a correctness bug in the recurrence math itself.
 */
export function daysUntilNextOccurrence(date: Date, from: Date = new Date()): number {
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const fromMidnight = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());

  let next = Date.UTC(from.getUTCFullYear(), month, day);
  if (next < fromMidnight) {
    next = Date.UTC(from.getUTCFullYear() + 1, month, day);
  }

  return Math.round((next - fromMidnight) / DAY_MS);
}

/**
 * Whether `date`'s yearly-recurring month+day falls within the next `days`
 * days (inclusive of today), relative to `from` (default: now). Shared by
 * `getBirthdaysThisWeek`/`getAnniversariesThisWeek` (called with `days: 6`
 * for a 7-day "this week" window: today through today+6).
 */
export function isWithinRecurringWindow(date: Date, days: number, from: Date = new Date()): boolean {
  return daysUntilNextOccurrence(date, from) <= days;
}

export interface RecurringDateEntry {
  customer: Customer;
  /** Days until the next occurrence of the birthday/anniversary, 0 = today. */
  daysUntil: number;
}

const THIS_WEEK_DAYS = 6; // today + 6 = 7-day window, matches [today, today+6]

/**
 * Customers whose `birthday` (month+day, year ignored) falls within the
 * next 7 days (today through today+6), sorted soonest-first. Customers
 * with `birthday: null` are excluded.
 */
export async function getBirthdaysThisWeek(from: Date = new Date()): Promise<RecurringDateEntry[]> {
  const customers = await prisma.customer.findMany({
    where: { birthday: { not: null } },
  });

  return customers
    .map((customer) => ({ customer, daysUntil: daysUntilNextOccurrence(customer.birthday as Date, from) }))
    .filter((entry) => entry.daysUntil <= THIS_WEEK_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Customers whose `anniversary` (month+day, year ignored) falls within the
 * next 7 days (today through today+6), sorted soonest-first. Customers
 * with `anniversary: null` are excluded. Same recurrence logic as
 * `getBirthdaysThisWeek`, applied to a different date field.
 */
export async function getAnniversariesThisWeek(from: Date = new Date()): Promise<RecurringDateEntry[]> {
  const customers = await prisma.customer.findMany({
    where: { anniversary: { not: null } },
  });

  return customers
    .map((customer) => ({ customer, daysUntil: daysUntilNextOccurrence(customer.anniversary as Date, from) }))
    .filter((entry) => entry.daysUntil <= THIS_WEEK_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export interface InactiveCustomerEntry {
  customer: Customer;
  /** Whole days since `lastVisitDate`, or `null` if the customer has never visited. */
  daysSinceLastVisit: number | null;
}

/**
 * Customers who are "inactive": either never visited (`lastVisitDate:
 * null`) or whose last visit was *more than* `days` days ago (strict `>`,
 * so a customer whose last visit was exactly `days` days ago is NOT yet
 * counted as inactive at that threshold — they cross into it the next
 * day). This matches `CustomerBadges`' `INACTIVE_AFTER_DAYS` convention of
 * "> N days" rather than ">= N days".
 *
 * Sorted most-stale-first: never-visited customers sort first (treated as
 * "more inactive than any dated last visit"), then by `lastVisitDate`
 * ascending (oldest visit first) among the rest.
 */
export async function getInactiveCustomers(
  days: 30 | 60 | 90 = 30,
  from: Date = new Date()
): Promise<InactiveCustomerEntry[]> {
  const cutoff = new Date(from.getTime() - days * DAY_MS);

  const customers = await prisma.customer.findMany({
    where: {
      OR: [{ lastVisitDate: null }, { lastVisitDate: { lt: cutoff } }],
    },
  });

  const withDays: InactiveCustomerEntry[] = customers.map((customer) => ({
    customer,
    daysSinceLastVisit: customer.lastVisitDate
      ? Math.floor((from.getTime() - customer.lastVisitDate.getTime()) / DAY_MS)
      : null,
  }));

  return withDays.sort((a, b) => {
    if (a.daysSinceLastVisit === null && b.daysSinceLastVisit === null) return 0;
    if (a.daysSinceLastVisit === null) return -1; // never-visited sorts first
    if (b.daysSinceLastVisit === null) return 1;
    return b.daysSinceLastVisit - a.daysSinceLastVisit; // most days-since first
  });
}

/**
 * Top `limit` customers by `totalPurchaseAmount`, descending. Customers
 * with zero spend are excluded — "top spenders" implies actual spend, and
 * a customer with ₹0 purchases (e.g. a freshly-registered profile with no
 * bills yet) isn't a meaningful entry on this list.
 */
export async function getTopSpenders(limit = 20): Promise<Customer[]> {
  return prisma.customer.findMany({
    where: { totalPurchaseAmount: { gt: 0 } },
    orderBy: { totalPurchaseAmount: "desc" },
    take: limit,
  });
}

export interface TopSpenderInRange {
  id: string;
  name: string;
  mobileNumber: string;
  totalSpend: number;
}

/**
 * Top spenders within `[start, end)`, by sum of `Bill.amount` in that
 * window — deliberately a separate function from `getTopSpenders` rather
 * than a date-filtered variant of it: that one ranks by `Customer.
 * totalPurchaseAmount`, an all-time rolling field maintained on every bill
 * mutation, which has no way to answer "top spenders in just this window"
 * (a customer's all-time total says nothing about what they spent in the
 * last 30 days specifically). Used by the Reports page's period filter;
 * `getTopSpenders` (all-time) still backs `/lists`' own Top Spenders view,
 * unchanged.
 */
export async function getTopSpendersInRange(
  start: Date,
  end: Date,
  limit = 20
): Promise<TopSpenderInRange[]> {
  const grouped = await prisma.bill.groupBy({
    by: ["customerId"],
    where: { date: { gte: start, lt: end } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const customers = await prisma.customer.findMany({
    where: { id: { in: grouped.map((g) => g.customerId) } },
    select: { id: true, name: true, mobileNumber: true },
  });
  const byId = new Map(customers.map((c) => [c.id, c]));

  return grouped
    .map((g) => {
      const customer = byId.get(g.customerId);
      if (!customer) return null;
      return { ...customer, totalSpend: g._sum.amount ?? 0 };
    })
    .filter((row): row is TopSpenderInRange => row !== null);
}

/**
 * Customers whose `customerSince` falls within the current calendar month
 * (1st of this month, 00:00, through `from`) — a real calendar-month
 * window, not a rolling 30-day one. Sorted newest-first.
 */
export async function getNewCustomersThisMonth(from: Date = new Date()): Promise<Customer[]> {
  const monthStart = new Date(from.getFullYear(), from.getMonth(), 1, 0, 0, 0, 0);

  return prisma.customer.findMany({
    where: { customerSince: { gte: monthStart, lte: from } },
    orderBy: { customerSince: "desc" },
  });
}
