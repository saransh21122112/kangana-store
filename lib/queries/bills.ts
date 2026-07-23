import { prisma } from "@/lib/prisma";
import type { Bill, Customer, Prisma } from "@/lib/generated/prisma/client";
import type { BillInput, BillUpdateInput } from "@/lib/validations/bill";

/**
 * Prisma's interactive-transaction defaults (`maxWait: 2000ms` to acquire a
 * connection, `timeout: 5000ms` for the transaction body to finish) are too
 * tight for this project's Neon Postgres connection, which was observed
 * during Stage 4 testing to regularly take 2-3s round-trip per query,
 * tripping `P2028: Unable to start a transaction in the given time` even
 * on legitimate, non-concurrent requests. Every `$transaction` call in this
 * file passes these longer options explicitly instead.
 */
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

/**
 * Recomputes and persists a Customer row's rollup fields
 * (totalPurchaseAmount, totalVisits, averageBillValue, lastVisitDate,
 * favouriteCategory) from scratch, by querying the Bill table fresh inside
 * the given transaction. Deliberately does NOT trust any incrementally-
 * updated running totals — bills can be created, edited, or deleted, so
 * the only correct source of truth on every call is a full re-aggregation
 * from the raw Bill rows belonging to this customer.
 */
export async function recalculateCustomerRollup(
  customerId: string,
  tx: Prisma.TransactionClient
): Promise<Customer> {
  const bills = await tx.bill.findMany({
    where: { customerId },
    select: { amount: true, date: true, category: true },
  });

  const totalVisits = bills.length;
  const totalPurchaseAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  const averageBillValue = totalVisits === 0 ? 0 : totalPurchaseAmount / totalVisits;
  const lastVisitDate =
    totalVisits === 0
      ? null
      : bills.reduce((max, b) => (b.date > max ? b.date : max), bills[0].date);

  let favouriteCategory: string | null = null;
  if (totalVisits > 0) {
    const byCategory = new Map<string, { amount: number; count: number }>();
    for (const b of bills) {
      const entry = byCategory.get(b.category) ?? { amount: 0, count: 0 };
      entry.amount += b.amount;
      entry.count += 1;
      byCategory.set(b.category, entry);
    }
    let best: { category: string; amount: number; count: number } | null = null;
    for (const [category, { amount, count }] of byCategory) {
      if (
        !best ||
        amount > best.amount ||
        (amount === best.amount && count > best.count)
      ) {
        best = { category, amount, count };
      }
    }
    favouriteCategory = best?.category ?? null;
  }

  return tx.customer.update({
    where: { id: customerId },
    data: {
      totalPurchaseAmount,
      totalVisits,
      averageBillValue,
      lastVisitDate,
      favouriteCategory,
    },
  });
}

export type CreateBillResult =
  | { ok: true; bill: Bill; customer: Customer }
  | { ok: false; reason: "duplicate_billNo" }
  | { ok: false; reason: "customer_not_found" };

/**
 * Creates a bill and recalculates the owning customer's rollup, in a single
 * transaction. Checks billNo uniqueness up front (mirroring
 * `createCustomer`'s duplicate-mobile pattern) rather than letting a raw
 * Prisma P2002 unique-constraint error bubble up.
 */
export async function createBillWithRollup(data: BillInput): Promise<CreateBillResult> {
  return prisma.$transaction(async (tx) => {
    const existingBillNo = await tx.bill.findUnique({
      where: { billNo: data.billNo },
      select: { id: true },
    });
    if (existingBillNo) {
      return { ok: false, reason: "duplicate_billNo" };
    }

    const customerExists = await tx.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true },
    });
    if (!customerExists) {
      return { ok: false, reason: "customer_not_found" };
    }

    const bill = await tx.bill.create({
      data: {
        billNo: data.billNo,
        date: data.date,
        amount: data.amount,
        category: data.category,
        customerId: data.customerId,
      },
    });

    const customer = await recalculateCustomerRollup(data.customerId, tx);

    return { ok: true, bill, customer };
  }, TRANSACTION_OPTIONS);
}

export type UpdateBillResult =
  | { ok: true; bill: Bill }
  | { ok: false; reason: "duplicate_billNo" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "customer_not_found" };

/**
 * Updates a bill and recalculates rollups for whichever customer(s) are
 * affected — normally just the one bill belongs to, but if `data.customerId`
 * moves the bill to a different customer, both the old and new customer's
 * rollups are recalculated.
 */
export async function updateBill(id: string, data: BillUpdateInput): Promise<UpdateBillResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.bill.findUnique({ where: { id } });
    if (!current) {
      return { ok: false, reason: "not_found" };
    }

    if (data.billNo && data.billNo !== current.billNo) {
      const existingBillNo = await tx.bill.findUnique({
        where: { billNo: data.billNo },
        select: { id: true },
      });
      if (existingBillNo) {
        return { ok: false, reason: "duplicate_billNo" };
      }
    }

    if (data.customerId && data.customerId !== current.customerId) {
      const customerExists = await tx.customer.findUnique({
        where: { id: data.customerId },
        select: { id: true },
      });
      if (!customerExists) {
        return { ok: false, reason: "customer_not_found" };
      }
    }

    const bill = await tx.bill.update({
      where: { id },
      data: {
        ...(data.billNo !== undefined ? { billNo: data.billNo } : {}),
        ...(data.date !== undefined ? { date: data.date } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.customerId !== undefined ? { customerId: data.customerId } : {}),
      },
    });

    await recalculateCustomerRollup(bill.customerId, tx);
    if (data.customerId && data.customerId !== current.customerId) {
      await recalculateCustomerRollup(current.customerId, tx);
    }

    return { ok: true, bill };
  }, TRANSACTION_OPTIONS);
}

export type DeleteBillResult = { ok: true } | { ok: false; reason: "not_found" };

/**
 * Deletes a bill and recalculates its (former) customer's rollup.
 */
export async function deleteBill(id: string): Promise<DeleteBillResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.bill.findUnique({ where: { id } });
    if (!current) {
      return { ok: false, reason: "not_found" };
    }

    await tx.bill.delete({ where: { id } });
    await recalculateCustomerRollup(current.customerId, tx);

    return { ok: true };
  }, TRANSACTION_OPTIONS);
}

export async function getBillById(id: string) {
  return prisma.bill.findUnique({ where: { id } });
}
