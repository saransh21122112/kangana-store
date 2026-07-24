import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"

import { requireRole } from "@/lib/auth/requireRole"
import { getBillWithCustomerById } from "@/lib/queries/bills"
import { getSettings } from "@/lib/queries/settings"
import { BillInvoiceDocument } from "@/lib/pdf/bill-invoice"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Single-bill PDF invoice download. Uses the same GET permissions as
 * `GET /api/bills/[id]` (OWNER/STAFF/VIEWER) — this is a printable copy of
 * a record the caller can already read, not a bulk data export, so it's
 * intentionally not restricted the way `/api/export/*` (CSV, no VIEWER) is.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF", "VIEWER"])
  if (!guard.ok) return guard.response

  const { id } = await params
  const [bill, settings] = await Promise.all([getBillWithCustomerById(id), getSettings()])

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 })
  }

  const pdfBuffer = await renderToBuffer(
    <BillInvoiceDocument bill={bill} storeName={settings.storeName} />
  )

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bill-${bill.billNo}.pdf"`,
    },
  })
}
