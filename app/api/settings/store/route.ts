import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { storeProfileSchema } from "@/lib/validations/settings";
import { getSettings, updateSettings } from "@/lib/queries/settings";

export async function GET() {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const settings = await getSettings();
  return NextResponse.json({
    storeName: settings.storeName,
    logoUrl: settings.logoUrl,
    accentColor: settings.accentColor,
  });
}

export async function PATCH(req: Request) {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = storeProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const settings = await updateSettings(parsed.data);
  return NextResponse.json({
    storeName: settings.storeName,
    logoUrl: settings.logoUrl,
    accentColor: settings.accentColor,
  });
}
