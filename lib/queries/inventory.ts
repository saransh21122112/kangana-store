import { prisma } from "@/lib/prisma";
import type { InventoryItem, Prisma } from "@/lib/generated/prisma/client";
import type {
  InventoryImportRowInput,
  InventoryItemInput,
  InventoryItemUpdateInput,
} from "@/lib/validations/inventory";

export interface GetAllInventoryItemsParams {
  /** Exact match against `category`. */
  category?: string;
  /** Exact match against `brand` — more precise than `search`'s
   * substring match, for when the caller already knows the exact brand
   * (e.g. picked from a dropdown sourced from `getDistinctBrands`). */
  brand?: string;
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
  const brand = params.brand?.trim();
  const search = params.search?.trim();

  const conditions: Prisma.InventoryItemWhereInput[] = [];

  if (category) {
    conditions.push({ category });
  }

  if (brand) {
    conditions.push({ brand });
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

/**
 * Distinct non-empty `brand` values across the catalog, for the inventory
 * filter bar's brand dropdown. Unlike `category` (a fixed, curated list from
 * `AppSettings`), brands come straight from the ~5,365 bulk-imported items —
 * there's no settings-managed list of them — so this queries the live data
 * instead.
 */
export async function getDistinctBrands(): Promise<string[]> {
  const rows = await prisma.inventoryItem.findMany({
    where: { brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
  });

  return rows
    .map((row) => row.brand)
    .filter((brand): brand is string => Boolean(brand && brand.trim()));
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

export interface BulkUpdateInventoryFromImportResult {
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Applies the CSV bulk-price-import's already-validated rows. Matches by
 * `id` only and never creates rows — the store's ~5,365 items were all
 * bulk-imported with a known `id` already, so an id that doesn't match an
 * existing row almost certainly means a hand-edited/duplicated/corrupted
 * spreadsheet cell, not a genuinely new item; silently inserting one here
 * would let a typo in Excel create a phantom SKU instead of surfacing the
 * mistake.
 *
 * NOT wrapped in a single `$transaction` — a real "import the whole
 * ~5,365-item catalog at once" run means that many sequential round-trips,
 * which blew straight through even a generous transaction timeout in
 * testing (same class of bug as the daily cron's low-stock notification
 * loop had before it was batched). Each row's `update` is already atomic on
 * its own, and a re-run of the same CSV is idempotent (it just overwrites
 * the same fields again), so a mid-import crash losing all-or-nothing
 * atomicity is an acceptable, easily-recoverable trade-off for actually
 * being able to complete a full-catalog import at all. Batched via
 * `Promise.all` in fixed-size chunks so the connection pool does real
 * concurrent work instead of one row at a time.
 */
export async function bulkUpdateInventoryFromImport(
  rows: InventoryImportRowInput[]
): Promise<BulkUpdateInventoryFromImportResult> {
  const errors: string[] = [];
  let updated = 0;
  let skipped = 0;

  const existingIds = new Set(
    (
      await prisma.inventoryItem.findMany({
        where: { id: { in: rows.map((row) => row.id) } },
        select: { id: true },
      })
    ).map((item) => item.id)
  );

  const rowsToUpdate = rows.filter((row) => {
    if (existingIds.has(row.id)) return true;
    skipped++;
    errors.push(`Row with id "${row.id}": no matching inventory item, skipped.`);
    return false;
  });

  const CHUNK_SIZE = 50;
  for (let i = 0; i < rowsToUpdate.length; i += CHUNK_SIZE) {
    const chunk = rowsToUpdate.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map((row) =>
        prisma.inventoryItem.update({
          where: { id: row.id },
          data: {
            ratePerUnit: row.ratePerUnit,
            quantity: row.quantity,
            lowStockThreshold: row.lowStockThreshold,
          },
        })
      )
    );
    updated += chunk.length;
  }

  return { updated, skipped, errors };
}

export interface BulkUpdateCategoryResult {
  count: number;
}

/**
 * Bulk recategorize for the Inventory table's multi-select bar. Unlike
 * `bulkUpdateInventoryFromImport` (where every row gets its own distinct
 * values), every selected row here gets the SAME new `category`, so a single
 * `updateMany` covers it natively — no per-row loop or chunking needed.
 */
export async function bulkUpdateCategory(
  ids: string[],
  category: string
): Promise<BulkUpdateCategoryResult> {
  const result = await prisma.inventoryItem.updateMany({
    where: { id: { in: ids } },
    data: { category },
  });

  return { count: result.count };
}
