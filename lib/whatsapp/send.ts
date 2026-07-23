import { prisma } from "@/lib/prisma";
import type { MessageType } from "@/lib/generated/prisma/client";
import { buildWaMeLink } from "@/lib/whatsapp/link-mode";
import { sendMessageCloud } from "@/lib/whatsapp/cloud-mode";

export interface SendMessageParams {
  customerId: string;
  type: MessageType;
  /** Fully-rendered message body (placeholders already substituted). */
  body: string;
}

export type SendMessageResult =
  | { ok: true; waLink: string; messageLogId: string }
  | { ok: false; error: string };

/**
 * Dispatches a single message according to `WHATSAPP_MODE` (defaults to
 * `"link"` if unset — this project only supports link mode for real, see
 * `cloud-mode.ts`).
 *
 * **Link-mode design decision:** WhatsApp `wa.me` links only do anything
 * once a human clicks them in a browser — there is no server-side delivery
 * confirmation available in link mode at all (no Cloud API webhook, no
 * delivery receipt). Rather than leaving every link-mode message stuck at
 * `PENDING` forever (which would make the "Messages Sent" tab/log look
 * broken), we write the `MessageLog` row as `status: "SENT"` with
 * `sentAt: now` on link generation itself — a deliberate best-effort
 * status that means "the app produced a send link for this message," not
 * "WhatsApp confirmed delivery." This matches the original spec's intent
 * for link mode (no delivery webhooks expected) and keeps the log usable
 * as a send-history record even though it can't be a delivery-confirmed
 * one. `DELIVERED`/`READ` statuses remain reserved for a future real
 * Cloud API integration that can receive delivery webhooks.
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const mode = process.env.WHATSAPP_MODE ?? "link";

  if (mode === "cloud" || mode === "api") {
    return sendMessageCloud(params);
  }

  const customer = await prisma.customer.findUnique({
    where: { id: params.customerId },
    select: { id: true, mobileNumber: true },
  });

  if (!customer) {
    return { ok: false, error: "Customer not found" };
  }

  const waLink = buildWaMeLink(customer.mobileNumber, params.body);

  const log = await prisma.messageLog.create({
    data: {
      customerId: customer.id,
      type: params.type,
      bodySent: params.body,
      status: "SENT",
      sentAt: new Date(),
    },
  });

  return { ok: true, waLink, messageLogId: log.id };
}
