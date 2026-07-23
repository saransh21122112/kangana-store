import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { customerSchema } from "@/lib/validations/customer";
import { createCustomer, getAllCustomers } from "@/lib/queries/customers";

export async function GET(req: Request) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;

  const customers = await getAllCustomers({ q });
  return NextResponse.json({ customers });
}

export async function POST(req: Request) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const result = await createCustomer(parsed.data);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "A customer with this mobile number already exists",
        reason: result.reason,
        existingCustomerId: result.existingCustomerId,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ customer: result.customer }, { status: 201 });
}
