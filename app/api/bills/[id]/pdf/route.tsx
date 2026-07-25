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
 * Single-bill PDF invoice download. OWNER/VIEWER only — STAFF can't see
 * bill amounts or customer phone numbers, both of which this PDF prints,
 * and the download button is hidden from STAFF's UI accordingly; this
 * closes the same gap at the API layer so a direct request can't bypass
 * that. VIEWER keeps read access (this is a printable copy of a record
 * they can already see elsewhere), so it's still not restricted the way
 * `/api/export/*` (CSV, OWNER-only) is.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "VIEWER"])
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
