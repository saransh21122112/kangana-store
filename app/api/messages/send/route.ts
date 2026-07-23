import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/prisma";
import { getTemplateById, renderTemplate } from "@/lib/queries/message-templates";
import { sendMessage } from "@/lib/whatsapp/send";

const messageTypeEnum = z.enum([
  "BIRTHDAY",
  "ANNIVERSARY",
  "FESTIVAL",
  "NEW_ARRIVALS",
  "MONTHLY_OFFER",
  "WE_MISS_YOU",
  "CUSTOM",
]);

/**
 * Either `templateId` (render the stored template for this customer) or an
 * explicit `body` + `type` (e.g. a one-off custom message) — mirrors the
 * brief's `{ customerId, templateId | body+type }` shape.
 */
const sendSchema = z
  .object({
    customerId: z.string().min(1),
    templateId: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    type: messageTypeEnum.optional(),
  })
  .refine((data) => data.templateId || (data.body && data.type), {
    message: "Provide either templateId, or both body and type",
  });

export async function POST(req: Request) {
  const guard = await requireRole(["OWNER", "STAFF"]);
  if (!guard.ok) return guard.response;

  const json = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { customerId, templateId, body, type } = parsed.data;

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  let renderedBody: string;
  let messageType: z.infer<typeof messageTypeEnum>;

  if (templateId) {
    const template = await getTemplateById(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    if (!template.isActive) {
      return NextResponse.json({ error: "This template is inactive" }, { status: 400 });
    }
    renderedBody = renderTemplate(template.body, customer);
    messageType = template.type;
  } else {
    renderedBody = renderTemplate(body as string, customer);
    messageType = type as z.infer<typeof messageTypeEnum>;
  }

  const result = await sendMessage({ customerId, type: messageType, body: renderedBody });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    waLink: result.waLink,
    messageLogId: result.messageLogId,
    body: renderedBody,
  });
}
