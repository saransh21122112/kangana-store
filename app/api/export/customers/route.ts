import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/prisma";
import { toCsv, type CsvColumn } from "@/lib/csv";

const COLUMNS: CsvColumn[] = [
  { key: "id", header: "id" },
  { key: "name", header: "name" },
  { key: "mobile", header: "mobile" },
  { key: "birthday", header: "birthday" },
  { key: "anniversary", header: "anniversary" },
  { key: "area", header: "area" },
  { key: "gender", header: "gender" },
  { key: "customerSince", header: "customerSince" },
  { key: "loyaltyPoints", header: "loyaltyPoints" },
  { key: "favouriteCategory", header: "favouriteCategory" },
  { key: "totalPurchaseAmount", header: "totalPurchaseAmount" },
  { key: "totalVisits", header: "totalVisits" },
  { key: "averageBillValue", header: "averageBillValue" },
  { key: "lastVisitDate", header: "lastVisitDate" },
];

export async function GET() {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const customers = await prisma.customer.findMany({ orderBy: { createdAt: "asc" } });

  const rows = customers.map((c) => ({
    id: c.id,
    name: c.name,
    mobile: c.mobileNumber,
    birthday: c.birthday,
    anniversary: c.anniversary,
    area: c.areaLocality,
    gender: c.gender,
    customerSince: c.customerSince,
    loyaltyPoints: c.loyaltyPoints,
    favouriteCategory: c.favouriteCategory,
    totalPurchaseAmount: c.totalPurchaseAmount,
    totalVisits: c.totalVisits,
    averageBillValue: c.averageBillValue,
    lastVisitDate: c.lastVisitDate,
  }));

  const csv = toCsv(rows, COLUMNS);
  const filename = `customers-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
