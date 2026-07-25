/**
 * Minimal shape needed to compute a bill line item's display label — kept
 * decoupled from the full `BillLineItem`/`InventoryItem` Prisma types (and
 * from `lib/queries/bills.ts`, which imports `prisma` and can't be pulled
 * into client components like `BillHistoryTable`) so this one function can
 * be shared across the PDF template, server pages, and client components
 * alike.
 */
export interface LineItemLabelSource {
  category: string
  inventoryItem?: { name: string } | null
}

/**
 * A bill line item is NOT required to link to a specific stocked
 * `InventoryItem` — free-text, category-only line items are a fully
 * supported path (staff just types a category with no product search), so
 * `category` remains a valid, permanent fallback, not a migration shim.
 * When a link DOES exist, the real product name (e.g. "ELLE 18 BASE PRIMER
 * 10ML") is far more useful to staff/customers than the broad reporting
 * category ("Makeup") alone, so it takes priority whenever present.
 */
export function lineItemDisplayLabel(lineItem: LineItemLabelSource): string {
  return lineItem.inventoryItem?.name ?? lineItem.category
}
