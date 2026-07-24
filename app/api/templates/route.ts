import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { getAllTemplates, createTemplate } from "@/lib/queries/message-templates";

const messageTypeEnum = z.enum([
  "BIRTHDAY",
  "ANNIVERSARY",
  "FESTIVAL",
  "NEW_ARRIVALS",
  "MONTHLY_OFFER",
  "WE_MISS_YOU",
  "CUSTOM",
]);

const createTemplateSchema = z.object({
  type: messageTypeEnum,
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const guard = await requireRole(["OWNER", "STAFF", "VIEWER"]);
  if (!guard.ok) return guard.response;

  const templates = await getAllTemplates();
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const template = await createTemplate(parsed.data);
  return NextResponse.json({ template }, { status: 201 });
}
