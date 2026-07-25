import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/prisma";
import { toCsv, type CsvColumn } from "@/lib/csv";

const COLUMNS: CsvColumn[] = [
  { key: "id", header: "id" },
  { key: "name", header: "name" },
  { key: "brand", header: "brand" },
  { key: "category", header: "category" },
  { key: "unitType", header: "unitType" },
  { key: "ratePerUnit", header: "ratePerUnit" },
  { key: "quantity", header: "quantity" },
  { key: "lowStockThreshold", header: "lowStockThreshold" },
];

export async function GET() {
  // OWNER only — same sensitivity level as the customers/bills exports, and
  // this is the file that round-trips back in through the OWNER-only
  // /api/inventory/import endpoint.
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const items = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });

  const rows = items.map((item) => ({
    id: item.id,
    name: item.name,
    brand: item.brand,
    category: item.category,
    unitType: item.unitType,
    ratePerUnit: item.ratePerUnit,
    quantity: item.quantity,
    lowStockThreshold: item.lowStockThreshold,
  }));

  const csv = toCsv(rows, COLUMNS);
  const filename = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
