import { format } from "date-fns";

import { prisma } from "@/lib/prisma";
import type { Customer, MessageTemplate, MessageType } from "@/lib/generated/prisma/client";

/** All templates, most-recently-updated first. */
export async function getAllTemplates(): Promise<MessageTemplate[]> {
  return prisma.messageTemplate.findMany({ orderBy: { updatedAt: "desc" } });
}

export async function getTemplateById(id: string): Promise<MessageTemplate | null> {
  return prisma.messageTemplate.findUnique({ where: { id } });
}

/** Active templates for a given type, e.g. to pick "the" BIRTHDAY template. */
export async function getTemplatesByType(type: MessageType): Promise<MessageTemplate[]> {
  return prisma.messageTemplate.findMany({
    where: { type },
    orderBy: { updatedAt: "desc" },
  });
}

export interface CreateTemplateInput {
  type: MessageType;
  title: string;
  body: string;
  isActive?: boolean;
}

export async function createTemplate(data: CreateTemplateInput): Promise<MessageTemplate> {
  return prisma.messageTemplate.create({ data });
}

export interface UpdateTemplateInput {
  title?: string;
  body?: string;
  isActive?: boolean;
}

export async function updateTemplate(
  id: string,
  data: UpdateTemplateInput
): Promise<MessageTemplate> {
  return prisma.messageTemplate.update({ where: { id }, data });
}

/**
 * Substitutes `{{placeholder}}` tokens in a template body with real values
 * from a `Customer` row. Matches the seeded templates' placeholder syntax
 * (`prisma/seed.ts`): `{{name}}`, plus this stage adds `{{loyaltyPoints}}`,
 * `{{lastVisitDate}}`, `{{favouriteCategory}}`.
 *
 * Fallback design (documented, not hidden): a missing/null field renders a
 * sensible human-readable fallback rather than leaving a raw `{{token}}` or
 * an empty gap in an otherwise-warm customer-facing message —
 * `{{name}}` → "Valued Customer" (should basically never happen, `name` is
 * required, but kept for safety), `{{lastVisitDate}}` → "your last visit",
 * `{{favouriteCategory}}` → "our collection". `{{loyaltyPoints}}` always has
 * a value (defaults to 0 on the schema) so it's just formatted as a number.
 * Unknown `{{tokens}}` not in this map are left untouched rather than
 * stripped, so a typo'd placeholder is visibly wrong (easy to spot/fix in
 * the live preview) instead of silently vanishing.
 */
export function renderTemplate(body: string, customer: Customer): string {
  const values: Record<string, string> = {
    name: customer.name || "Valued Customer",
    loyaltyPoints: String(customer.loyaltyPoints ?? 0),
    lastVisitDate: customer.lastVisitDate
      ? format(new Date(customer.lastVisitDate), "d MMM yyyy")
      : "your last visit",
    favouriteCategory: customer.favouriteCategory || "our collection",
  };

  return body.replace(/\{\{(\w+)\}\}/g, (match, token: string) => {
    return token in values ? values[token] : match;
  });
}
