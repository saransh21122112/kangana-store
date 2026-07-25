import { prisma } from "@/lib/prisma";
import type { InventoryItem, Prisma } from "@/lib/generated/prisma/client";
import type {
  InventoryItemInput,
  InventoryItemUpdateInput,
} from "@/lib/validations/inventory";

export interface GetAllInventoryItemsParams {
  /** Exact match against `category`. */
  category?: string;
  /**
   * Case-insensitive substring match against `name` OR `brand` — backs the
   * bill-creation search bar, which needs to find an item across ~5,000+
   * SKUs by typing a few characters of either the product name or its brand.
   */
  search?: string;
  /**
   * Filters to items at or below their own `lowStockThreshold`. Prisma can't
   * compare two columns of the same row directly in a simple `where`, so
   * this is done via fetch-then-filter-in-JS (fine at this app's scale)
   * rather than reaching for `$queryRaw`.
   */
  lowStockOnly?: boolean;
  /** Caps the result count — defaults to 20 when `search` is set (a
   * search-bar dropdown only ever needs a short list of matches), otherwise
   * unbounded (the full `/inventory` page listing). Pass explicitly to
   * override either default. */
  limit?: number;
}

/**
 * List query — mirrors `getAllCustomers`'s conditional `where`-building
 * pattern. Ordered by name for a stable, predictable list view.
 */
export async function getAllInventoryItems(
  params: GetAllInventoryItemsParams = {}
): Promise<InventoryItem[]> {
  const category = params.category?.trim();
  const search = params.search?.trim();

  const conditions: Prisma.InventoryItemWhereInput[] = [];

  if (category) {
    conditions.push({ category });
  }

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const items = await prisma.inventoryItem.findMany({
    where: conditions.length > 0 ? { AND: conditions } : undefined,
    orderBy: { name: "asc" },
    take: params.limit ?? (search ? 20 : undefined),
  });

  if (params.lowStockOnly) {
    return items.filter((item) => item.quantity <= item.lowStockThreshold);
  }

  return items;
}

export async function getInventoryItemById(id: string): Promise<InventoryItem | null> {
  return prisma.inventoryItem.findUnique({ where: { id } });
}

export async function createInventoryItem(data: InventoryItemInput): Promise<InventoryItem> {
  return prisma.inventoryItem.create({
    data: {
      name: data.name,
      category: data.category,
      brand: data.brand,
      unitType: data.unitType,
      ratePerUnit: data.ratePerUnit,
      quantity: data.quantity,
      lowStockThreshold: data.lowStockThreshold,
    },
  });
}

export type UpdateInventoryItemResult =
  | { ok: true; item: InventoryItem }
  | { ok: false; reason: "not_found" };

/** Partial update of name/category/lowStockThreshold — quantity changes go
 * through `adjustStock` instead. */
export async function updateInventoryItem(
  id: string,
  data: InventoryItemUpdateInput
): Promise<UpdateInventoryItemResult> {
  const current = await prisma.inventoryItem.findUnique({ where: { id }, select: { id: true } });
  if (!current) {
    return { ok: false, reason: "not_found" };
  }

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.brand !== undefined ? { brand: data.brand } : {}),
      ...(data.unitType !== undefined ? { unitType: data.unitType } : {}),
      ...(data.ratePerUnit !== undefined ? { ratePerUnit: data.ratePerUnit } : {}),
      ...(data.lowStockThreshold !== undefined
        ? { lowStockThreshold: data.lowStockThreshold }
        : {}),
    },
  });

  return { ok: true, item };
}

export type AdjustStockResult =
  | { ok: true; item: InventoryItem }
  | { ok: false; reason: "not_found" };

/**
 * Applies a delta (positive to add stock, negative to remove) to an item's
 * quantity, clamped server-side so it can never go below 0 regardless of
 * what delta the client sends.
 */
export async function adjustStock(id: string, delta: number): Promise<AdjustStockResult> {
  const current = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!current) {
    return { ok: false, reason: "not_found" };
  }

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: { quantity: Math.max(0, current.quantity + delta) },
  });

  return { ok: true, item };
}

export type DeleteInventoryItemResult = { ok: true } | { ok: false; reason: "not_found" };

export async function deleteInventoryItem(id: string): Promise<DeleteInventoryItemResult> {
  const current = await prisma.inventoryItem.findUnique({ where: { id }, select: { id: true } });
  if (!current) {
    return { ok: false, reason: "not_found" };
  }

  await prisma.inventoryItem.delete({ where: { id } });
  return { ok: true };
}

/**
 * Items at or below their own `lowStockThreshold`, for the dashboard's
 * low-stock card. Same JS-filter approach as `getAllInventoryItems`'s
 * `lowStockOnly` option — kept as a separate export since a dashboard-facing
 * caller shouldn't need to know about the list-query's filter params shape.
 */
export async function getLowStockItems(): Promise<InventoryItem[]> {
  const items = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
  return items.filter((item) => item.quantity <= item.lowStockThreshold);
}
