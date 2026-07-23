import { prisma } from "@/lib/prisma";
import { escapeLikeWildcards } from "@/lib/queries/like-escape";

export interface SearchCustomerResult {
  id: string;
  name: string;
  mobileNumber: string;
  lastVisitDate: Date | null;
}

const DEFAULT_LIMIT = 8;

/**
 * Global command-palette search: case-insensitive `contains` match against
 * `name` OR `mobileNumber`. Deliberately minimal (no fuzzy ranking/scoring)
 * — same spirit as `getAllCustomers`'s existing `q` param from Stage 4, but
 * kept as its own query/file since the command palette wants a tighter,
 * capped result set and a narrower field selection than the full customer
 * list ever needs.
 */
export async function searchCustomers(
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<SearchCustomerResult[]> {
  const q = query.trim();
  if (!q) return [];
  const likeQ = escapeLikeWildcards(q);

  return prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: likeQ, mode: "insensitive" } },
        { mobileNumber: { contains: likeQ } },
      ],
    },
    select: { id: true, name: true, mobileNumber: true, lastVisitDate: true },
    orderBy: { name: "asc" },
    take: limit,
  });
}
