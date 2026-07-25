import { prisma } from "@/lib/prisma";
import type { Bill, BillLineItem, Customer, Prisma } from "@/lib/generated/prisma/client";
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
export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

/** Fixed id for the singleton `AppSettings` row — mirrors `lib/queries/settings.ts`'s
 * `SETTINGS_ID`, duplicated here rather than imported to keep this file's
 * in-transaction read self-contained. */
const SETTINGS_ID = "singleton";

/** Fallback rate if the settings row is somehow missing inside a
 * transaction — matches the schema's own `@default(0.01)` for
 * `loyaltyPointsPerRupee`, so a missing row never blocks bill creation. */
const DEFAULT_LOYALTY_POINTS_PER_RUPEE = 0.01;

export async function getLoyaltyPointsPerRupee(tx: Prisma.TransactionClient): Promise<number> {
  const settings = await tx.appSettings.findUnique({ where: { id: SETTINGS_ID } });
  return settings?.loyaltyPointsPerRupee ?? DEFAULT_LOYALTY_POINTS_PER_RUPEE;
}

/**
 * Recomputes and persists a Customer row's rollup fields
 * (totalPurchaseAmount, totalVisits, averageBillValue, lastVisitDate,
 * favouriteCategory) from scratch, by querying the Bill table fresh inside
 * the given transaction. Deliberately does NOT trust any incrementally-
 * updated running totals — bills can be created, edited, or deleted, so
 * the only correct source of truth on every call is a full re-aggregation
 * from the raw Bill rows belonging to this customer.
 *
 * `favouriteCategory` is now computed from the customer's `BillLineItem`
 * rows (grouped by `lineItem.category`, weighted by each line's NET amount
 * — `lineTotal` minus anything already returned against it — rather than
 * `Bill.category`, since a bill no longer has a single category of its own,
 * only its line items do.
 *
 * `totalPurchaseAmount`/`averageBillValue` are similarly computed from each
 * bill's line items' NET totals (rather than trusting `bill.amount`, which
 * is left as the original, unreturned sale total) so a partial return
 * actually reduces a customer's real spend rather than sitting invisibly in
 * a side table. `totalVisits`/`lastVisitDate` are unaffected by returns — a
 * bill with a partial return is still a visit that happened on its date.
 */
export async function recalculateCustomerRollup(
  customerId: string,
  tx: Prisma.TransactionClient
): Promise<Customer> {
  const bills = await tx.bill.findMany({
    where: { customerId },
    select: {
      date: true,
      lineItems: {
        select: {
          category: true,
          lineTotal: true,
          returns: { select: { amountReturned: true } },
        },
      },
    },
  });

  function netLineTotal(lineItem: { lineTotal: number; returns: { amountReturned: number }[] }) {
    const returned = lineItem.returns.reduce((sum, r) => sum + r.amountReturned, 0);
    return Math.max(0, lineItem.lineTotal - returned);
  }

  const totalVisits = bills.length;
  const totalPurchaseAmount = bills.reduce(
    (sum, b) => sum + b.lineItems.reduce((lineSum, li) => lineSum + netLineTotal(li), 0),
    0
  );
  const averageBillValue = totalVisits === 0 ? 0 : totalPurchaseAmount / totalVisits;
  const lastVisitDate =
    totalVisits === 0
      ? null
      : bills.reduce((max, b) => (b.date > max ? b.date : max), bills[0].date);

  let favouriteCategory: string | null = null;
  if (totalVisits > 0) {
    const byCategory = new Map<string, { amount: number; count: number }>();
    for (const bill of bills) {
      for (const lineItem of bill.lineItems) {
        const entry = byCategory.get(lineItem.category) ?? { amount: 0, count: 0 };
        entry.amount += netLineTotal(lineItem);
        entry.count += 1;
        byCategory.set(lineItem.category, entry);
      }
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

type BillWithLineItems = Bill & { lineItems: BillLineItem[] };

export type CreateBillResult =
  | { ok: true; bill: BillWithLineItems; customer: Customer }
  | { ok: false; reason: "duplicate_billNo" }
  | { ok: false; reason: "customer_not_found" }
  | { ok: false; reason: "inventory_item_not_found" }
  | { ok: false; reason: "insufficient_stock" };

/**
 * Creates a bill with its "shopping cart" of `BillLineItem`s and recalculates
 * the owning customer's rollup, all in a single transaction. Checks billNo
 * uniqueness up front (mirroring `createCustomer`'s duplicate-mobile
 * pattern) rather than letting a raw Prisma P2002 unique-constraint error
 * bubble up.
 *
 * Stock is checked/decremented per DISTINCT `inventoryItemId`, aggregated
 * across every line item that references it — not per line item
 * independently. Two line items on the same bill referencing the same
 * tracked item (e.g. quantities 3 and 4 against a stock of 5) must be
 * caught as a combined request of 7, which two independent per-line checks
 * of "3 <= 5" and "4 <= 5" would each wrongly pass.
 *
 * Also awards loyalty points on the new bill's total (`amount * loyaltyPointsPerRupee`,
 * floored), before returning.
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

    const customer = await tx.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      return { ok: false, reason: "customer_not_found" };
    }

    // Aggregate requested quantity per distinct inventoryItemId across ALL
    // line items before checking stock — see function doc comment.
    const requestedQuantityByItem = new Map<string, number>();
    for (const lineItem of data.lineItems) {
      if (!lineItem.inventoryItemId) continue;
      requestedQuantityByItem.set(
        lineItem.inventoryItemId,
        (requestedQuantityByItem.get(lineItem.inventoryItemId) ?? 0) + lineItem.quantity
      );
    }

    for (const [inventoryItemId, totalQuantityRequested] of requestedQuantityByItem) {
      const item = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (!item) {
        return { ok: false, reason: "inventory_item_not_found" };
      }
      if (item.quantity < totalQuantityRequested) {
        return { ok: false, reason: "insufficient_stock" };
      }
    }

    const amount = Math.round(
      data.lineItems.reduce((sum, li) => sum + li.lineTotal, 0) * 100
    ) / 100;

    const bill = await tx.bill.create({
      data: {
        billNo: data.billNo,
        date: data.date,
        amount,
        customerId: data.customerId,
        lineItems: {
          create: data.lineItems.map((li) => ({
            category: li.category,
            inventoryItemId: li.inventoryItemId ?? null,
            quantity: li.quantity,
            unitPrice: li.unitPrice ?? null,
            lineTotal: li.lineTotal,
          })),
        },
      },
      include: { lineItems: true },
    });

    for (const [inventoryItemId, totalQuantityRequested] of requestedQuantityByItem) {
      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { quantity: { decrement: totalQuantityRequested } },
      });
    }

    const loyaltyPointsPerRupee = await getLoyaltyPointsPerRupee(tx);
    const pointsEarned = Math.floor(bill.amount * loyaltyPointsPerRupee);
    if (pointsEarned !== 0) {
      await tx.customer.update({
        where: { id: data.customerId },
        data: { loyaltyPoints: { increment: pointsEarned } },
      });
    }

    const updatedCustomer = await recalculateCustomerRollup(data.customerId, tx);

    return { ok: true, bill, customer: updatedCustomer };
  }, TRANSACTION_OPTIONS);
}

export type UpdateBillResult =
  | { ok: true; bill: Bill }
  | { ok: false; reason: "duplicate_billNo" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "customer_not_found" };

/**
 * Updates a bill's header fields (billNo/date/customerId only — editing
 * line items after creation is out of scope, per `billUpdateSchema`) and
 * recalculates rollups for whichever customer(s) are affected — normally
 * just the one bill belongs to, but if `data.customerId` moves the bill to
 * a different customer, both the old and new customer's rollups are
 * recalculated.
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
 * Deletes a bill and recalculates its (former) customer's rollup. Reads the
 * bill's `lineItems` BEFORE deleting (needed for the stock/loyalty
 * reversal below) — `BillLineItem` rows themselves are removed
 * automatically via the schema's `onDelete: Cascade` once `tx.bill.delete`
 * runs, no manual delete needed.
 *
 * Restores (increments) stock for every line item that referenced an
 * `InventoryItem`, one increment call per line item — unlike the
 * check-then-decrement path in `createBillWithRollup`, sequential
 * increments don't need to be pre-aggregated per distinct item first: there's
 * no validation step being bypassed by doing them one at a time, so two
 * line items referencing the same item just apply as two increments that
 * sum to the same total either way.
 *
 * Also claws back the loyalty points the bill would have earned, using the
 * CURRENT `loyaltyPointsPerRupee` rate (this schema doesn't store the rate
 * that was in effect at earn time, so this is an accepted simplification),
 * clamped so `loyaltyPoints` never goes negative.
 */
export async function deleteBill(id: string): Promise<DeleteBillResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.bill.findUnique({ where: { id }, include: { lineItems: true } });
    if (!current) {
      return { ok: false, reason: "not_found" };
    }

    for (const lineItem of current.lineItems) {
      if (!lineItem.inventoryItemId) continue;
      await tx.inventoryItem.update({
        where: { id: lineItem.inventoryItemId },
        data: { quantity: { increment: lineItem.quantity } },
      });
    }

    const loyaltyPointsPerRupee = await getLoyaltyPointsPerRupee(tx);
    const pointsToClawBack = Math.floor(current.amount * loyaltyPointsPerRupee);
    if (pointsToClawBack !== 0) {
      const customer = await tx.customer.findUnique({
        where: { id: current.customerId },
        select: { loyaltyPoints: true },
      });
      if (customer) {
        await tx.customer.update({
          where: { id: current.customerId },
          data: { loyaltyPoints: Math.max(0, customer.loyaltyPoints - pointsToClawBack) },
        });
      }
    }

    await tx.bill.delete({ where: { id } });
    await recalculateCustomerRollup(current.customerId, tx);

    return { ok: true };
  }, TRANSACTION_OPTIONS);
}

export async function getBillById(id: string) {
  return prisma.bill.findUnique({
    where: { id },
    include: { lineItems: { include: { returns: true } } },
  });
}

/** Like `getBillById`, but joined with the full owning `Customer` row —
 * needed for the PDF invoice (customer name/mobile) rather than just the
 * bill's own fields. Also joins each line item's linked `InventoryItem` (if
 * any) so the invoice can print the actual product name instead of just its
 * broad category — see `lib/bill-line-item-label.ts`. */
export async function getBillWithCustomerById(id: string) {
  return prisma.bill.findUnique({
    where: { id },
    include: { customer: true, lineItems: { include: { inventoryItem: true } } },
  });
}

export interface GetAllBillsParams {
  /** Matches bills having ANY line item in this category. */
  category?: string;
  /** Inclusive lower bound on `amount`. */
  minAmount?: number;
  /** Inclusive upper bound on `amount`. */
  maxAmount?: number;
  /** Inclusive lower bound on `date`. */
  dateFrom?: Date;
  /** Inclusive upper bound on `date`. */
  dateTo?: Date;
}

/**
 * Global bill list (`/bills`), reverse-chronological, joined with the
 * owning customer's name/mobile for display, and with each bill's line
 * items. All filters AND together and are all optional, mirroring
 * `getAllCustomers`'s filter-object shape from Stage 8 for consistency.
 *
 * `category` no longer matches `Bill.category` directly (a bill has no
 * single category of its own anymore) — it now matches bills that have at
 * least one `BillLineItem` in that category.
 */
export async function getAllBills(params: GetAllBillsParams = {}) {
  const { category, minAmount, maxAmount, dateFrom, dateTo } = params;

  const where: Prisma.BillWhereInput = {};
  if (category) where.lineItems = { some: { category } };
  if (minAmount !== undefined || maxAmount !== undefined) {
    where.amount = {
      ...(minAmount !== undefined ? { gte: minAmount } : {}),
      ...(maxAmount !== undefined ? { lte: maxAmount } : {}),
    };
  }
  if (dateFrom !== undefined || dateTo !== undefined) {
    where.date = {
      ...(dateFrom !== undefined ? { gte: dateFrom } : {}),
      ...(dateTo !== undefined ? { lte: dateTo } : {}),
    };
  }

  return prisma.bill.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      customer: { select: { id: true, name: true, mobileNumber: true } },
      // `inventoryItem` is also joined so the "Category" column can prefer
      // the linked product's real name — see `lib/bill-line-item-label.ts`.
      lineItems: { include: { returns: true, inventoryItem: true } },
    },
  });
}
