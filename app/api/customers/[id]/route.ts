import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { customerUpdateSchema } from "@/lib/validations/customer";
import { getCustomerById, updateCustomer } from "@/lib/queries/customers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ customer });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = customerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const result = await updateCustomer(id, parsed.data);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "A customer with this mobile number already exists",
        reason: result.reason,
        existingCustomerId: result.existingCustomerId,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ customer: result.customer });
}
