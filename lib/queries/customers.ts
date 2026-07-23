import { prisma } from "@/lib/prisma";
import type { Customer, Prisma } from "@/lib/generated/prisma/client";
import type { CustomerInput, CustomerUpdateInput } from "@/lib/validations/customer";
import { escapeLikeWildcards } from "@/lib/queries/like-escape";

/** Visit-frequency bucket, mapped onto `totalVisits` ranges by `getAllCustomers`. */
export type VisitFrequencyBucket = "1" | "2-5" | "6+";

export interface GetAllCustomersParams {
  /** Simple cap for now — Stage 8 adds real URL-param filtering/pagination. */
  take?: number;
  /**
   * Case-insensitive search against name or mobileNumber. Added in Stage 4
   * for `AddBillGlobalSheet`'s search-as-you-type customer lookup — kept
   * minimal (no fuzzy matching/ranking) rather than duplicating this query
   * logic in a second place.
   */
  q?: string;
  /** Exact match against `favouriteCategory`. Stage 8. */
  category?: string;
  /** Bucketed `totalVisits` filter. Stage 8. */
  visitFrequency?: VisitFrequencyBucket;
  /** Inclusive lower bound on `totalPurchaseAmount`. Stage 8. */
  minSpend?: number;
  /** Inclusive upper bound on `totalPurchaseAmount`. Stage 8. */
  maxSpend?: number;
  /** Inclusive lower bound on `lastVisitDate`. Stage 8. */
  lastVisitFrom?: Date;
  /** Inclusive upper bound on `lastVisitDate`. Stage 8. */
  lastVisitTo?: Date;
}

/**
 * Maps a `VisitFrequencyBucket` onto a Prisma numeric-range filter for
 * `totalVisits`. `"6+"` is intentionally open-ended (no upper bound).
 */
function visitFrequencyToRange(bucket: VisitFrequencyBucket): { gte?: number; lte?: number } {
  switch (bucket) {
    case "1":
      return { gte: 1, lte: 1 };
    case "2-5":
      return { gte: 2, lte: 5 };
    case "6+":
      return { gte: 6 };
  }
}

/**
 * List query, extended in Stage 8 to accept a full filter object alongside
 * the existing `q` search — all filters AND together, and all remain
 * optional so every pre-existing no-arg/`{q}`-only call site keeps working
 * unchanged (`AddBillGlobalSheet`, etc.). Ordered by name for a stable,
 * predictable list view.
 */
export async function getAllCustomers(params: GetAllCustomersParams = {}) {
  const q = params.q?.trim();
  const category = params.category?.trim();

  const conditions: Prisma.CustomerWhereInput[] = [];

  if (q) {
    const likeQ = escapeLikeWildcards(q);
    conditions.push({
      OR: [
        { name: { contains: likeQ, mode: "insensitive" } },
        { mobileNumber: { contains: likeQ } },
      ],
    });
  }

  if (category) {
    conditions.push({ favouriteCategory: category });
  }

  if (params.visitFrequency) {
    conditions.push({ totalVisits: visitFrequencyToRange(params.visitFrequency) });
  }

  if (params.minSpend !== undefined || params.maxSpend !== undefined) {
    conditions.push({
      totalPurchaseAmount: {
        ...(params.minSpend !== undefined ? { gte: params.minSpend } : {}),
        ...(params.maxSpend !== undefined ? { lte: params.maxSpend } : {}),
      },
    });
  }

  if (params.lastVisitFrom !== undefined || params.lastVisitTo !== undefined) {
    conditions.push({
      lastVisitDate: {
        ...(params.lastVisitFrom !== undefined ? { gte: params.lastVisitFrom } : {}),
        ...(params.lastVisitTo !== undefined ? { lte: params.lastVisitTo } : {}),
      },
    });
  }

  return prisma.customer.findMany({
    where: conditions.length > 0 ? { AND: conditions } : undefined,
    orderBy: { name: "asc" },
    take: params.take,
  });
}

/**
 * Returns the set of customer ids in the top 10% by `totalPurchaseAmount`
 * (min 1 customer if any exist), for VIP badge computation. Kept as a
 * separate query (rather than a per-customer flag on the model) since "top
 * 10%" is inherently relative to the whole customer base.
 */
export async function getVipCustomerIds(): Promise<Set<string>> {
  const customers = await prisma.customer.findMany({
    select: { id: true, totalPurchaseAmount: true },
    orderBy: { totalPurchaseAmount: "desc" },
  });
  if (customers.length === 0) return new Set();

  const vipCount = Math.max(1, Math.ceil(customers.length * 0.1));
  return new Set(customers.slice(0, vipCount).map((c) => c.id));
}

export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      bills: { orderBy: { date: "desc" } },
      messagesLog: { orderBy: { createdAt: "desc" } },
    },
  });
}

export type CreateCustomerResult =
  | { ok: true; customer: Customer }
  | { ok: false; reason: "duplicate_mobile"; existingCustomerId: string };

/**
 * Creates a customer, first checking for an existing row with the same
 * `mobileNumber` so the caller (API route) can respond with a clear,
 * distinguishable "already exists" result instead of a raw Prisma unique-
 * constraint error (P2002).
 */
export async function createCustomer(data: CustomerInput): Promise<CreateCustomerResult> {
  const existing = await prisma.customer.findUnique({
    where: { mobileNumber: data.mobileNumber },
    select: { id: true },
  });

  if (existing) {
    return { ok: false, reason: "duplicate_mobile", existingCustomerId: existing.id };
  }

  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      mobileNumber: data.mobileNumber,
      birthday: data.birthday,
      anniversary: data.anniversary,
      areaLocality: data.areaLocality ?? undefined,
      gender: data.gender ?? undefined,
    },
  });

  return { ok: true, customer };
}

export type UpdateCustomerResult =
  | { ok: true; customer: Customer }
  | { ok: false; reason: "duplicate_mobile"; existingCustomerId: string }
  | { ok: false; reason: "not_found" };

/**
 * Updates a customer. If `mobileNumber` is being changed, checks it doesn't
 * collide with a *different* customer's number first, for the same reason
 * `createCustomer` does.
 */
export async function updateCustomer(
  id: string,
  data: CustomerUpdateInput
): Promise<UpdateCustomerResult> {
  const current = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!current) {
    return { ok: false, reason: "not_found" };
  }

  if (data.mobileNumber) {
    const existing = await prisma.customer.findUnique({
      where: { mobileNumber: data.mobileNumber },
      select: { id: true },
    });
    if (existing && existing.id !== id) {
      return { ok: false, reason: "duplicate_mobile", existingCustomerId: existing.id };
    }
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.mobileNumber !== undefined ? { mobileNumber: data.mobileNumber } : {}),
      ...(data.birthday !== undefined ? { birthday: data.birthday } : {}),
      ...(data.anniversary !== undefined ? { anniversary: data.anniversary } : {}),
      ...(data.areaLocality !== undefined ? { areaLocality: data.areaLocality ?? null } : {}),
      ...(data.gender !== undefined ? { gender: data.gender ?? null } : {}),
    },
  });

  return { ok: true, customer };
}
