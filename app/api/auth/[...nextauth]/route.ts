import type { NextRequest } from "next/server";

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;

export async function HEAD(request: NextRequest) {
  return await handlers.GET(request);
}
