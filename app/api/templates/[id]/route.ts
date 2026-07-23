import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { getTemplateById, updateTemplate } from "@/lib/queries/message-templates";

const updateTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const template = await getTemplateById(id);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await getTemplateById(id);
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const template = await updateTemplate(id, parsed.data);
  return NextResponse.json({ template });
}
