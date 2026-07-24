import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { billUpdateSchema } from "@/lib/validations/bill";
import { deleteBill, getBillById, updateBill } from "@/lib/queries/bills";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF", "VIEWER"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const bill = await getBillById(id);

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  return NextResponse.json({ bill });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = billUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const result = await updateBill(id, parsed.data);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }
    if (result.reason === "duplicate_billNo") {
      return NextResponse.json(
        { error: "A bill with this bill number already exists", reason: result.reason },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Customer not found", reason: result.reason },
      { status: 404 }
    );
  }

  return NextResponse.json({ bill: result.bill });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const result = await deleteBill(id);

  if (!result.ok) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
