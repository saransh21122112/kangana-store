import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/prisma";
import { toCsv, type CsvColumn } from "@/lib/csv";

const COLUMNS: CsvColumn[] = [
  { key: "id", header: "id" },
  { key: "billNo", header: "billNo" },
  { key: "date", header: "date" },
  { key: "amount", header: "amount" },
  { key: "category", header: "category" },
  { key: "customerId", header: "customerId" },
  { key: "customerName", header: "customerName" },
];

export async function GET() {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const bills = await prisma.bill.findMany({
    orderBy: { date: "asc" },
    include: { customer: { select: { name: true } } },
  });

  const rows = bills.map((b) => ({
    id: b.id,
    billNo: b.billNo,
    date: b.date,
    amount: b.amount,
    category: b.category,
    customerId: b.customerId,
    customerName: b.customer.name,
  }));

  const csv = toCsv(rows, COLUMNS);
  const filename = `bills-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
