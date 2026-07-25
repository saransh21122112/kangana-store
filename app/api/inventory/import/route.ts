import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/requireRole";
import { parseCsv } from "@/lib/csv";
import { inventoryImportRowSchema } from "@/lib/validations/inventory";
import { bulkUpdateInventoryFromImport } from "@/lib/queries/inventory";

/**
 * Bulk price/quantity/threshold import for the CSV round-trip described in
 * Settings' Export tab: owner exports `/api/export/inventory`, fills in
 * `ratePerUnit` (mostly 0 for all ~5,365 bulk-imported items) in Excel, and
 * re-uploads here. OWNER-only — treated as sensitive as DELETE endpoints
 * throughout this app, since it's a bulk write across the whole catalog
 * from an uploaded file rather than one row at a time through the UI.
 */
export async function POST(req: Request) {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No CSV file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const records = parseCsv(text);

  if (records.length === 0) {
    return NextResponse.json({ error: "CSV file has no data rows" }, { status: 400 });
  }

  // Validate every row up front and collect per-row errors, rather than
  // failing the whole import on one bad row — a 5,000+ row spreadsheet
  // edited by hand in Excel is expected to have the occasional typo'd cell.
  const validRows: { id: string; ratePerUnit: number; quantity: number; lowStockThreshold: number }[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2; // +1 for 0-index, +1 for the header row
    const parsed = inventoryImportRowSchema.safeParse(record);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join("; ");
      errors.push(`Row ${rowNumber}: ${message}`);
      return;
    }
    validRows.push(parsed.data);
  });

  if (validRows.length === 0) {
    return NextResponse.json({ updated: 0, skipped: records.length, errors });
  }

  const result = await bulkUpdateInventoryFromImport(validRows);

  return NextResponse.json({
    updated: result.updated,
    skipped: result.skipped + (records.length - validRows.length),
    errors: [...errors, ...result.errors],
  });
}
