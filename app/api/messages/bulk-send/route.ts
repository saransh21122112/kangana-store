import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/prisma";
import { getTemplateById, renderTemplate } from "@/lib/queries/message-templates";
import { sendMessage } from "@/lib/whatsapp/send";

const bulkSendSchema = z.object({
  customerIds: z.array(z.string().min(1)).min(1, "Select at least one customer"),
  templateId: z.string().min(1),
});

export interface BulkSendResultEntry {
  customerId: string;
  customerName: string;
  waLink: string;
  messageLogId: string;
}

/**
 * Link-mode can't truly bulk-send server-side (no server-side delivery at
 * all in this mode — see `lib/whatsapp/send.ts`). This route's job is just
 * to pre-render every recipient's message, create their `MessageLog` rows,
 * and hand back the full array of `{customerId, waLink, ...}` so the
 * client can sequence through them one user-gesture click at a time via
 * `SendQueueList` (browsers block programmatic multi-window `window.open`
 * calls not tied to a direct click).
 */
export async function POST(req: Request) {
  const guard = await requireRole(["OWNER"]);
  if (!guard.ok) return guard.response;

  const json = await req.json().catch(() => null);
  const parsed = bulkSendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { customerIds, templateId } = parsed.data;

  const template = await getTemplateById(templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (!template.isActive) {
    return NextResponse.json({ error: "This template is inactive" }, { status: 400 });
  }

  const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } } });
  const customersById = new Map(customers.map((c) => [c.id, c]));

  const results: BulkSendResultEntry[] = [];
  const failures: { customerId: string; error: string }[] = [];

  for (const customerId of customerIds) {
    const customer = customersById.get(customerId);
    if (!customer) {
      failures.push({ customerId, error: "Customer not found" });
      continue;
    }

    const renderedBody = renderTemplate(template.body, customer);
    const result = await sendMessage({ customerId, type: template.type, body: renderedBody });

    if (!result.ok) {
      failures.push({ customerId, error: result.error });
      continue;
    }

    results.push({
      customerId,
      customerName: customer.name,
      waLink: result.waLink,
      messageLogId: result.messageLogId,
    });
  }

  return NextResponse.json({ results, failures });
}
