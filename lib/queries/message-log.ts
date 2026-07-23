import { prisma } from "@/lib/prisma";
import type { MessageLog, MessageStatus, MessageType } from "@/lib/generated/prisma/client";

export interface CreateMessageLogInput {
  customerId: string;
  type: MessageType;
  bodySent: string;
  status?: MessageStatus;
  sentAt?: Date | null;
}

/**
 * Direct `MessageLog` create, for callers that already have a rendered
 * body and don't need `send.ts`'s wa.me-link-building behavior (e.g. a
 * future Cloud API webhook handler). `lib/whatsapp/send.ts`'s
 * `sendMessage()` creates its own log row inline rather than calling this,
 * since it needs the created row's `id` back synchronously as part of a
 * single flow — this function exists for other/future call sites.
 */
export async function createMessageLog(data: CreateMessageLogInput): Promise<MessageLog> {
  return prisma.messageLog.create({ data });
}

/** Messages sent to a customer, most recent first — feeds the "Messages Sent" profile tab. */
export async function getMessageLogsForCustomer(customerId: string): Promise<MessageLog[]> {
  return prisma.messageLog.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
}
