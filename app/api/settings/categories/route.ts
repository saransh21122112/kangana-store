import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { categoriesSchema } from "@/lib/validations/settings";
import { getSettings, updateSettings } from "@/lib/queries/settings";

/**
 * GET is OWNER-or-STAFF: STAFF needs the live category list when adding a
 * bill (see AddBillForm), so read access can't be OWNER-only. Only the
 * PATCH mutation is OWNER-gated.
 */
export async function GET() {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const settings = await getSettings();
  return NextResponse.json({ categories: settings.categories });
}

export async function PATCH(req: Request) {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = categoriesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const settings = await updateSettings({ categories: parsed.data.categories });
  return NextResponse.json({ categories: settings.categories });
}
