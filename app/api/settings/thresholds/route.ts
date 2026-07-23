import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { thresholdsSchema } from "@/lib/validations/settings";
import { getSettings, updateSettings } from "@/lib/queries/settings";

export async function GET() {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const settings = await getSettings();
  return NextResponse.json({
    inactiveThreshold30: settings.inactiveThreshold30,
    inactiveThreshold60: settings.inactiveThreshold60,
    inactiveThreshold90: settings.inactiveThreshold90,
  });
}

export async function PATCH(req: Request) {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = thresholdsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const settings = await updateSettings(parsed.data);
  return NextResponse.json({
    inactiveThreshold30: settings.inactiveThreshold30,
    inactiveThreshold60: settings.inactiveThreshold60,
    inactiveThreshold90: settings.inactiveThreshold90,
  });
}
